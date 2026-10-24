import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { UserRole, OrderStatus } from '@aweermarket/types';
import { authenticate, requireRole } from '../plugins/security.js';
import {
  listAllUsers,
  countUsers,
  setUserActiveStatus,
  findUserById
} from '../models/user.model.js';
import {
  listAllShops,
  countShops,
  setShopApproval,
  setShopActiveStatus,
  findShopById
} from '../models/shop.model.js';
import {
  listAllProductsAdmin,
  countProducts,
  setProductActiveStatus,
  setOffersActiveForShop,
  findProductById
} from '../models/product.model.js';
import {
  countOrders,
  listAllOrdersAdmin,
  getOrderFinancialMetrics
} from '../models/order.model.js';
import {
  listAllCategories,
  findCategoryById,
  createCategory,
  updateCategory,
  setCategoryStatus,
  deleteCategory
} from '../models/category.model.js';
import { CreateCategorySchema, UpdateCategorySchema } from '@aweermarket/validation';

/**
 * PreHandler hook: Live Super Admin database verification.
 * Enforces that the authenticated user:
 * 1. Authoritatively exists in the database.
 * 2. Has active account status (isActive === true).
 * 3. Currently holds the database role of SUPER_ADMIN.
 * Stale JWT tokens from deactivated or demoted accounts are rejected.
 */
export async function requireActiveSuperAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = request.user?.userId;
  if (!userId) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  const dbUser = request.dbUser || await findUserById(userId);
  if (!dbUser) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Super admin account not found'
    });
  }

  if (!dbUser.isActive) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Super admin account has been deactivated'
    });
  }

  if (dbUser.role !== UserRole.SUPER_ADMIN) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Access denied: insufficient permissions'
    });
  }
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // All admin routes strictly require Super Admin authentication and live DB verification
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole(UserRole.SUPER_ADMIN));
  fastify.addHook('preHandler', requireActiveSuperAdmin);

  /**
   * GET /api/v1/admin/overview
   * Real platform metrics and counters across users, stalls, products, and orders.
   */
  fastify.get('/overview', async (_request: FastifyRequest, reply: FastifyReply) => {
    const [userCounts, shopCounts, productCounts, orderCount, financials] = await Promise.all([
      countUsers(),
      countShops(),
      countProducts(),
      countOrders(),
      getOrderFinancialMetrics()
    ]);

    return reply.status(200).send({
      statusCode: 200,
      metrics: {
        totalUsers: userCounts.total,
        buyers: userCounts.buyers,
        shopAdmins: userCounts.shopAdmins,
        superAdmins: userCounts.superAdmins,
        totalShops: shopCounts.total,
        approvedShops: shopCounts.approved,
        pendingShops: shopCounts.pending,
        totalProducts: productCounts.total,
        activeProducts: productCounts.active,
        inactiveProducts: productCounts.inactive,
        totalOrders: orderCount,
        financials
      }
    });
  });

  /**
   * GET /api/v1/admin/shops
   * Lists all Al Aweer wholesale stalls with approval and active status.
   */
  fastify.get('/shops', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: string };
    let filter: { isApproved?: boolean } | undefined;

    if (query.status === 'approved') {
      filter = { isApproved: true };
    } else if (query.status === 'pending') {
      filter = { isApproved: false };
    }

    const shops = await listAllShops(filter);
    return reply.status(200).send({
      statusCode: 200,
      shops: shops.map((s) => s.toPublicSummary())
    });
  });

  /**
   * PATCH /api/v1/admin/shops/:id/approval
   * Approves or suspends a vendor wholesale stall.
   */
  fastify.patch('/shops/:id/approval', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { isApproved?: boolean };

    if (typeof body?.isApproved !== 'boolean') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: "Property 'isApproved' (boolean) is required in request body"
      });
    }

    const shop = await findShopById(id);
    if (!shop) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Shop not found'
      });
    }

    await setShopApproval(id, body.isApproved);
    // Cascade: Deactivate stall offers when unapproved, or re-activate when approved
    await setOffersActiveForShop(id, body.isApproved);
    const updated = await findShopById(id);

    return reply.status(200).send({
      statusCode: 200,
      message: body.isApproved ? 'Shop approved successfully' : 'Shop approval revoked / suspended',
      shop: updated ? updated.toPublicSummary() : null
    });
  });

  /**
   * PATCH /api/v1/admin/shops/:id/status
   * Delists or reactivates a vendor stall and cascades to offer visibility.
   */
  fastify.patch('/shops/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { isActive?: boolean };

    if (typeof body?.isActive !== 'boolean') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: "Property 'isActive' (boolean) is required in request body"
      });
    }

    const shop = await findShopById(id);
    if (!shop) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Shop not found'
      });
    }

    await setShopActiveStatus(id, body.isActive);
    await setOffersActiveForShop(id, body.isActive);
    const updated = await findShopById(id);

    return reply.status(200).send({
      statusCode: 200,
      message: body.isActive ? 'Shop activated' : 'Shop suspended and delisted from marketplace',
      shop: updated ? updated.toPublicSummary() : null
    });
  });

  /**
   * GET /api/v1/admin/users
   * Lists registered platform users with role filters.
   */
  fastify.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { role?: string };
    let roleFilter: UserRole | undefined;

    if (query.role && (Object.values(UserRole) as string[]).includes(query.role)) {
      roleFilter = query.role as UserRole;
    }

    const users = await listAllUsers(roleFilter ? { role: roleFilter } : undefined);
    return reply.status(200).send({
      statusCode: 200,
      users: users.map((u) => u.toUserSummary())
    });
  });

  /**
   * PATCH /api/v1/admin/users/:id/status
   * Suspends or reactivates a user account.
   */
  fastify.patch('/users/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { isActive?: boolean };

    if (typeof body?.isActive !== 'boolean') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: "Property 'isActive' (boolean) is required in request body"
      });
    }

    // Safety: Prevent super admin from accidentally deactivating their own account
    if (request.user?.userId === id && !body.isActive) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Super Admin cannot deactivate their own active session account'
      });
    }

    const user = await findUserById(id);
    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'User account not found'
      });
    }

    await setUserActiveStatus(id, body.isActive);
    const updated = await findUserById(id);

    return reply.status(200).send({
      statusCode: 200,
      message: body.isActive ? 'User account reactivated' : 'User account suspended',
      user: updated ? updated.toUserSummary() : null
    });
  });

  /**
   * GET /api/v1/admin/products
   * Lists all products including inactive / unmoderated produce listings.
   */
  fastify.get('/products', async (_request: FastifyRequest, reply: FastifyReply) => {
    const products = await listAllProductsAdmin();
    return reply.status(200).send({
      statusCode: 200,
      products: products.map((p) => p.toPublicProductItem())
    });
  });

  /**
   * PATCH /api/v1/admin/products/:id/moderation
   * Moderates produce listing (activates or delists/unpublishes from marketplace).
   */
  fastify.patch('/products/:id/moderation', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { isActive?: boolean };

    if (typeof body?.isActive !== 'boolean') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: "Property 'isActive' (boolean) is required in request body"
      });
    }

    const product = await findProductById(id);
    if (!product) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Product not found'
      });
    }

    await setProductActiveStatus(id, body.isActive);
    const updated = await findProductById(id);

    return reply.status(200).send({
      statusCode: 200,
      message: body.isActive ? 'Product activated and published' : 'Product delisted and moderated',
      product: updated ? updated.toPublicProductItem() : null
    });
  });

  /**
   * GET /api/v1/admin/orders
   * Platform-wide wholesale transaction oversight and marketplace commission tracking.
   */
  fastify.get('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: string; shopId?: string };
    let statusFilter: OrderStatus | undefined;

    if (query.status && (Object.values(OrderStatus) as string[]).includes(query.status)) {
      statusFilter = query.status as OrderStatus;
    }

    const [orders, financials] = await Promise.all([
      listAllOrdersAdmin({
        status: statusFilter,
        shopId: query.shopId?.trim()
      }),
      getOrderFinancialMetrics()
    ]);

    const formattedOrders = orders.map((o) => {
      const gmv = o.totalAmountAed;
      const commissionAed = Math.round(gmv * 0.05 * 100) / 100;

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        buyerId: o.buyerId,
        shopId: o.shopId,
        shopName: o.shopName,
        stallNumber: o.stallNumber || '—',
        deliveryType: o.deliveryType,
        deliveryAddress: o.deliveryAddress,
        pickupTime: o.pickupTime,
        status: o.status,
        totalAmountAed: gmv,
        commissionAed,
        commissionRatePercent: 5,
        items: o.items.map((it) => ({
          productId: it.productId,
          name: it.name,
          unit: it.unit,
          unitWeightKg: it.unitWeightKg,
          quantity: it.quantity,
          unitPriceAed: it.unitPriceAed,
          lineTotalAed: Math.round(it.quantity * it.unitPriceAed * 100) / 100
        })),
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString()
      };
    });

    return reply.status(200).send({
      statusCode: 200,
      financials,
      orders: formattedOrders
    });
  });

  /**
   * GET /api/v1/admin/categories
   * Lists all wholesale produce categories (both active and inactive) with product counts.
   */
  fastify.get('/categories', async (_request: FastifyRequest, reply: FastifyReply) => {
    const categories = await listAllCategories();
    return reply.status(200).send({
      statusCode: 200,
      categories
    });
  });

  /**
   * POST /api/v1/admin/categories
   * Creates a new wholesale produce category.
   */
  fastify.post('/categories', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateCategorySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Invalid category input'
      });
    }

    try {
      const category = await createCategory(parseResult.data);
      return reply.status(201).send({
        statusCode: 201,
        message: 'Category created successfully',
        category
      });
    } catch (err: any) {
      if (err.statusCode === 409) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: err.message
        });
      }
      throw err;
    }
  });

  /**
   * PUT /api/v1/admin/categories/:id
   * Updates an existing category's properties.
   */
  fastify.put('/categories/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = UpdateCategorySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Invalid category update input'
      });
    }

    try {
      const updated = await updateCategory(id, parseResult.data);
      if (!updated) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Category not found'
        });
      }

      return reply.status(200).send({
        statusCode: 200,
        message: 'Category updated successfully',
        category: updated
      });
    } catch (err: any) {
      if (err.statusCode === 409) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: err.message
        });
      }
      throw err;
    }
  });

  /**
   * PATCH /api/v1/admin/categories/:id/status
   * Toggles category active/inactive status.
   */
  fastify.patch('/categories/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { isActive?: boolean };

    if (typeof body?.isActive !== 'boolean') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: "Property 'isActive' (boolean) is required in request body"
      });
    }

    const updated = await setCategoryStatus(id, body.isActive);
    if (!updated) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Category not found'
      });
    }

    return reply.status(200).send({
      statusCode: 200,
      message: body.isActive ? 'Category activated' : 'Category deactivated',
      category: updated
    });
  });

  /**
   * DELETE /api/v1/admin/categories/:id
   * Deletes a category, or safely deactivates it if active produce items exist.
   */
  fastify.delete('/categories/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await deleteCategory(id);

    if (!result.success) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: result.message || 'Category not found'
      });
    }

    return reply.status(200).send({
      statusCode: 200,
      message: result.message || 'Category deleted successfully',
      deactivated: Boolean(result.deactivated)
    });
  });
};
