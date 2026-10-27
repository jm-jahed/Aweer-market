import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { CreateOrderSchema } from '@aweermarket/validation';
import { UserRole } from '@aweermarket/types';
import { authenticate } from '../plugins/security.js';
import { findShopById, findShopByOwnerId } from '../models/shop.model.js';
import { findUserById } from '../models/user.model.js';
import { findProductById, reserveOfferStock, rollbackOfferStock } from '../models/product.model.js';
import { createOrderRecord, findOrdersByBuyerId, findOrderById } from '../models/order.model.js';

/**
 * Helper to resolve the authenticated vendor's shop ID securely from the authoritative database.
 * Stale-session immune & strictly fail-closed:
 * 1. Requires authenticated user to exist in the database and have isActive === true.
 * 2. Resolves stall using database references (dbUser.shopId or findShopByOwnerId).
 * 3. Enforces that the shop exists, shop.ownerId === request.user.userId, and shop.isActive === true.
 * 4. Never trusts a session shopId claim as sufficient proof of authorization.
 * 5. Does not swallow database errors; let infrastructure failures bubble up.
 */
async function resolveVendorShopId(request: FastifyRequest): Promise<string | null> {
  const userId = request.user?.userId;
  if (!userId) {
    return null;
  }

  // 1. Authoritative check: User must exist in database and be active
  const dbUser = request.dbUser || await findUserById(userId);
  if (!dbUser || !dbUser.isActive) {
    return null;
  }

  // 2. Identify the vendor's stall using database references
  let shop = null;
  if (dbUser.shopId) {
    shop = await findShopById(dbUser.shopId);
  }
  if (!shop) {
    shop = await findShopByOwnerId(userId);
  }

  if (!shop) {
    return null;
  }

  // 3. Strict database ownership verification: shop owner MUST match the authenticated user
  if (shop.ownerId !== userId) {
    return null;
  }

  // 4. Stall status verification: suspended/inactive shops cannot access orders
  if (!shop.isActive) {
    return null;
  }

  return shop.id;
}

export const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  // All order routes require authenticated session
  fastify.addHook('preHandler', authenticate);


  /**
   * POST /api/v1/orders
   * Creates a wholesale produce order with server-authoritative price calculation
   * and atomic offer stock reservation.
   * STRICT ROLE ENFORCEMENT: Only registered buyers can place wholesale orders.
   */
  fastify.post('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || user.role !== UserRole.BUYER) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: Only registered buyers can place wholesale orders'
      });
    }

    // Authoritative check: User must exist in database, be active, and hold BUYER role
    const dbUser = request.dbUser || await findUserById(user.userId);
    if (!dbUser) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Buyer account not found'
      });
    }

    if (!dbUser.isActive) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Buyer account has been deactivated'
      });
    }

    if (dbUser.role !== UserRole.BUYER) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: Only registered buyers can place wholesale orders'
      });
    }

    const parseResult = CreateOrderSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Invalid order parameters'
      });
    }

    const { shopId: reqShopId, vendorId, deliveryType, deliveryAddress, pickupTime, items } = parseResult.data;
    const shopId = (reqShopId || vendorId)!.trim();

    // 1. Verify that shop exists and is approved for selling
    const shop = await findShopById(shopId);
    if (!shop || !shop.isActive || !shop.isApproved) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Selected stall does not exist or is not approved for wholesale ordering'
      });
    }

    // 2. Validate items, resolve server prices, check MOQ, and reserve stock atomically
    const reservedItems: Array<{ productId: string; quantity: number }> = [];
    const resolvedOrderItems: Array<{
      productId: string;
      name: string;
      unit: any;
      unitWeightKg: number;
      quantity: number;
      unitPriceAed: number;
    }> = [];

    for (const item of items) {
      const product = await findProductById(item.productId);
      if (!product || !product.isActive) {
        // Rollback any reserved stock before returning error
        for (const resItem of reservedItems) {
          await rollbackOfferStock(resItem.productId, shopId, resItem.quantity);
        }
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Product ${item.productId} not found or is currently unavailable`
        });
      }

      const offer = product.offers.find((o) => o.shopId === shopId && o.isActive);
      if (!offer) {
        for (const resItem of reservedItems) {
          await rollbackOfferStock(resItem.productId, shopId, resItem.quantity);
        }
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Stall '${shop.name}' does not offer product '${product.name}'`
        });
      }

      // Check Minimum Order Quantity (MOQ)
      const minQty = offer.minOrderQuantity || 1;
      if (item.quantity < minQty) {
        for (const resItem of reservedItems) {
          await rollbackOfferStock(resItem.productId, shopId, resItem.quantity);
        }
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Minimum order quantity for '${product.name}' is ${minQty} ${offer.unit}s`
        });
      }

      // Atomically reserve stock
      const reservation = await reserveOfferStock(product.id, shopId, item.quantity);
      if (!reservation.success) {
        for (const resItem of reservedItems) {
          await rollbackOfferStock(resItem.productId, shopId, resItem.quantity);
        }
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: reservation.error || `Insufficient stock for product '${product.name}'`
        });
      }

      reservedItems.push({ productId: product.id, quantity: item.quantity });
      resolvedOrderItems.push({
        productId: product.id,
        name: product.name,
        unit: offer.unit,
        unitWeightKg: offer.unitWeightKg,
        quantity: item.quantity,
        unitPriceAed: offer.priceAed // Server price authority
      });
    }

    try {
      // 3. Create persisted order record
      const order = await createOrderRecord({
        buyerId: user.userId,
        shopId,
        shopName: shop.name,
        stallNumber: shop.stallNumber,
        deliveryType,
        deliveryAddress,
        pickupTime,
        items: resolvedOrderItems
      });

      return reply.status(201).send({
        statusCode: 201,
        message: 'Order created successfully',
        order
      });
    } catch (err: unknown) {
      // If order creation fails, rollback reserved stock
      for (const resItem of reservedItems) {
        await rollbackOfferStock(resItem.productId, shopId, resItem.quantity);
      }
      throw err;
    }
  });

  /**
   * GET /api/v1/orders
   * Retrieves all orders placed by the authenticated buyer.
   */
  fastify.get('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || user.role !== UserRole.BUYER) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: Only registered buyers can access order history'
      });
    }

    const dbUser = await findUserById(user.userId);
    if (!dbUser) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Buyer account not found'
      });
    }

    if (!dbUser.isActive) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Buyer account has been deactivated'
      });
    }

    if (dbUser.role !== UserRole.BUYER) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: Only registered buyers can access order history'
      });
    }

    const orders = await findOrdersByBuyerId(user.userId);

    return reply.status(200).send({
      statusCode: 200,
      orders
    });
  });

  /**
   * GET /api/v1/orders/:id
   * Retrieves single order by ID with strict tenant & ownership verification.
   * - Buyer: Can only view their own placed orders.
   * - Shop Admin / Vendor: Can only view orders fulfilling items from their own stall.
   * - Super Admin: Global audit oversight permitted.
   * - All other cases / missing association: Fail closed with 403 Forbidden.
   */
  fastify.get('/orders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const order = await findOrderById(id);

    if (!order) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Order not found'
      });
    }

    // Role-bound ownership authorization matrix
    if (user.role === UserRole.BUYER) {
      const dbUser = request.dbUser || await findUserById(user.userId);
      if (!dbUser || !dbUser.isActive || dbUser.role !== UserRole.BUYER) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Access denied: You do not have permission to view this order'
        });
      }

      if (order.buyerId !== user.userId) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Access denied: You do not have permission to view this order'
        });
      }
    } else if (user.role === UserRole.SHOP_ADMIN || user.role === UserRole.VENDOR) {
      const vendorShopId = await resolveVendorShopId(request);
      if (!vendorShopId || order.shopId !== vendorShopId) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Access denied: You do not have permission to view this order'
        });
      }
    } else if (user.role !== UserRole.SUPER_ADMIN) {
      // Any other role or unapproved privilege fails closed
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: You do not have permission to view this order'
      });
    }

    const formattedOrder = {
      ...(typeof (order as any).toObject === 'function' ? (order as any).toObject() : order),
      id: order.id || (order as any)._id?.toString()
    };

    return reply.status(200).send({
      statusCode: 200,
      order: formattedOrder
    });
  });
};

