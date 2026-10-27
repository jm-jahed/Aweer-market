import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { UserRole, OrderStatus } from '@aweermarket/types';
import {
  UpdateShopProfileSchema,
  CreateProductSchema,
  UpdateProductOfferSchema,
  UpdateOrderStatusSchema
} from '@aweermarket/validation';
import { authenticate, requireRole } from '../plugins/security.js';
import { findShopById, findShopByOwnerId, updateShop } from '../models/shop.model.js';
import { findUserById } from '../models/user.model.js';
import {
  findProductByName,
  findProductById,
  createProduct,
  addOrUpdateProductOffer,
  updateProductOffer,
  listProductsByVendor,
  rollbackOfferStock
} from '../models/product.model.js';
import { findOrdersByShopId, findOrderById, updateOrderStatus } from '../models/order.model.js';
import {
  validateImageBuffer,
  isR2Configured,
  uploadProductImageToR2,
  deleteProductImageFromR2,
  isValidProductImageKey
} from '../services/r2StorageService.js';
import { rateLimitUpload } from '../plugins/rate-limit.js';

export const vendorRoutes: FastifyPluginAsync = async (fastify) => {
  // All vendor routes require valid authentication and SHOP_ADMIN (or legacy VENDOR) role
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole(UserRole.SHOP_ADMIN));

  /**
   * Resolves the authenticated vendor's authoritative shop ID strictly from database state.
   *
   * Security Architecture (Phase 2.1 Hardening):
   * 1. Checks live User model: User must exist in the database and user.isActive === true.
   * 2. Checks live Shop model: Looks up shop by dbUser.shopId or findShopByOwnerId(userId).
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

    // 4. Stall status verification: suspended/inactive shops cannot access vendor endpoints
    if (!shop.isActive) {
      return null;
    }

    return shop.id;
  }

  /**
   * GET /api/v1/vendor/shop
   * Retrieves the authenticated vendor's own Al Aweer wholesale stall.
   */
  fastify.get('/shop', async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = await resolveVendorShopId(request);
    if (!shopId) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'No shop associated with this vendor account'
      });
    }

    const shop = await findShopById(shopId);
    if (!shop) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Shop record not found'
      });
    }

    return reply.status(200).send({
      statusCode: 200,
      shop: shop.toPublicSummary()
    });
  });

  /**
   * PATCH /api/v1/vendor/shop
   * Updates stall name, phone, or stall number for the authenticated vendor's own stall.
   * STRICT TENANT ISOLATION: The vendor cannot specify an external shopId, nor can they self-approve.
   */
  fastify.patch('/shop', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = UpdateShopProfileSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors.map((e) => e.message).join('; ')
      });
    }

    const shopId = await resolveVendorShopId(request);
    if (!shopId) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'No shop associated with this vendor account'
      });
    }

    const updatedShop = await updateShop(shopId, parseResult.data);
    if (!updatedShop) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Shop record not found'
      });
    }

    return reply.status(200).send({
      statusCode: 200,
      message: 'Shop details updated successfully',
      shop: updatedShop.toPublicSummary()
    });
  });

  /**
   * GET /api/v1/vendor/products
   * Lists all produce items where the authenticated vendor has an offer.
   */
  fastify.get('/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = await resolveVendorShopId(request);
    if (!shopId) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'No shop associated with this vendor account'
      });
    }

    const products = await listProductsByVendor(shopId);

    const vendorProducts = products.map((prod) => {
      const stallOffer = prod.offers.find((o) => o.shopId === shopId);
      return {
        id: prod.id,
        name: prod.name,
        category: prod.category,
        originCountry: prod.originCountry,
        description: prod.description,
        imageUrl: (prod as { imageUrl?: string }).imageUrl || '',
        lowestPriceAedPerKg: prod.lowestPriceAedPerKg,
        offer: stallOffer || null
      };
    });

    return reply.status(200).send({
      statusCode: 200,
      products: vendorProducts
    });
  });

  /**
   * POST /api/v1/vendor/products
   * Adds produce or appends stall offer to an existing produce item in the marketplace catalog.
   */
  fastify.post('/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateProductSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors.map((e) => e.message).join('; ')
      });
    }

    const shopId = await resolveVendorShopId(request);
    if (!shopId) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'No shop associated with this vendor account'
      });
    }

    const shop = await findShopById(shopId);
    if (!shop) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Shop record not found'
      });
    }

    const { name, category, originCountry, description, imageUrl, offer } = parseResult.data;

    // Check if produce item already exists in catalog
    const existing = await findProductByName(name);
    let product;

    if (existing) {
      // Append or update vendor's offer on this shared produce item
      product = await addOrUpdateProductOffer(existing.id, {
        shopId: shop.id,
        shopName: shop.name,
        stallNumber: shop.stallNumber,
        unit: offer.unit,
        unitWeightKg: offer.unitWeightKg,
        priceAed: offer.priceAed,
        minOrderQuantity: offer.minOrderQuantity,
        availableStock: offer.availableStock,
        isActive: true
      });
    } else {
      // Create new produce item with vendor's initial offer
      product = await createProduct({
        name,
        category,
        originCountry,
        description,
        imageUrl,
        offers: [
          {
            shopId: shop.id,
            shopName: shop.name,
            stallNumber: shop.stallNumber,
            unit: offer.unit,
            unitWeightKg: offer.unitWeightKg,
            priceAed: offer.priceAed,
            minOrderQuantity: offer.minOrderQuantity,
            availableStock: offer.availableStock,
            isActive: true
          }
        ]
      });
    }

    return reply.status(201).send({
      statusCode: 201,
      message: 'Produce offer added to catalog successfully',
      product: product ? product.toPublicProductItem() : null
    });
  });

  /**
   * PATCH /api/v1/vendor/products/:id/offer
   * Updates price, stock, or MOQ of the vendor's own offer on a produce item.
   * STRICT TENANT ISOLATION: A vendor can ONLY modify their own stall's offer.
   */
  fastify.patch('/products/:id/offer', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const parseResult = UpdateProductOfferSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors.map((e) => e.message).join('; ')
      });
    }

    const shopId = await resolveVendorShopId(request);
    if (!shopId) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'No shop associated with this vendor account'
      });
    }

    const { id: productId } = request.params;
    const product = await findProductById(productId);
    if (!product) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Produce item not found'
      });
    }

    // Verify vendor has an offer on this product
    const vendorOffer = product.offers.find((o) => o.shopId === shopId);
    if (!vendorOffer) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: You do not have an active offer for this produce item'
      });
    }

    const updatedProduct = await updateProductOffer(productId, shopId, parseResult.data);

    return reply.status(200).send({
      statusCode: 200,
      message: 'Offer updated successfully',
      product: updatedProduct ? updatedProduct.toPublicProductItem() : null
    });
  });

  /**
   * GET /api/v1/vendor/orders
   * Retrieves all orders placed for the authenticated vendor's stall.
   */
  fastify.get('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = await resolveVendorShopId(request);
    if (!shopId) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'No shop associated with this vendor account'
      });
    }

    const orders = await findOrdersByShopId(shopId);
    const mappedOrders = orders.map((o: any) => ({
      id: o.id || o._id?.toString(),
      orderNumber: o.orderNumber,
      buyerId: o.buyerId,
      shopId: o.shopId,
      shopName: o.shopName,
      stallNumber: o.stallNumber,
      deliveryType: o.deliveryType,
      deliveryAddress: o.deliveryAddress,
      pickupTime: o.pickupTime,
      status: o.status,
      totalAmountAed: o.totalAmountAed,
      items: o.items,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt
    }));

    return reply.status(200).send({
      statusCode: 200,
      orders: mappedOrders
    });
  });

  /**
   * PATCH /api/v1/vendor/orders/:id/status
   * Updates fulfillment status for an order belonging to the vendor's stall.
   * If cancelled, automatically rolls back reserved offer stock.
   */
  fastify.patch('/orders/:id/status', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id: orderId } = request.params;
    if (!orderId || orderId === 'undefined' || orderId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid order identifier provided'
      });
    }

    const parseResult = UpdateOrderStatusSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Invalid order status'
      });
    }

    const shopId = await resolveVendorShopId(request);
    if (!shopId) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'No shop associated with this vendor account'
      });
    }

    const order = await findOrderById(orderId);
    if (!order) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Order not found'
      });
    }

    // Tenant check: vendor can only update orders for their own stall
    if (order.shopId !== shopId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: You cannot modify orders for another stall'
      });
    }

    const newStatus = parseResult.data.status;
    const previousStatus = order.status;

    const updated = await updateOrderStatus(orderId, newStatus);

    // If order was cancelled and was not already cancelled, restore reserved stock
    if (newStatus === OrderStatus.CANCELLED && previousStatus !== OrderStatus.CANCELLED) {
      for (const item of order.items) {
        await rollbackOfferStock(item.productId, shopId, item.quantity);
      }
    }

    const formattedOrder = updated ? {
      ...(typeof (updated as any).toObject === 'function' ? (updated as any).toObject() : updated),
      id: updated.id || (updated as any)._id?.toString()
    } : null;

    return reply.status(200).send({
      statusCode: 200,
      message: `Order status updated to ${newStatus}`,
      order: formattedOrder
    });
  });

  /**
   * POST /api/v1/vendor/upload
   * Authenticated, shop-scoped product image upload to Cloudflare R2
   * Rate limited: 20 uploads / minute per vendor account
   */
  fastify.post('/upload', { preHandler: [rateLimitUpload] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = await resolveVendorShopId(request);
    if (!shopId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'No active shop associated with this vendor account or permissions revoked'
      });
    }

    let fileData;
    try {
      fileData = await request.file();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse multipart file';
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Multipart upload error: ${msg}`
      });
    }

    if (!fileData) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'No image file provided in upload request'
      });
    }

    // Immediate check if stream was truncated by Fastify multipart limits
    if ((fileData as any).file?.truncated) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'File size exceeds maximum allowed limit of 5 MiB.'
      });
    }

    let buffer: Buffer;
    try {
      buffer = await fileData.toBuffer();
    } catch (err: unknown) {
      const isOversized = err && typeof err === 'object' && 'code' in err && (err as any).code === 'FST_REQ_FILE_TOO_LARGE';
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: isOversized ? 'File size exceeds maximum allowed limit of 5 MiB.' : 'Failed to read uploaded image stream'
      });
    }

    if (!buffer || buffer.length === 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Uploaded file is empty'
      });
    }

    const validation = validateImageBuffer(buffer);
    if (!validation.isValid) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: validation.error || 'Invalid image file'
      });
    }

    if (!isR2Configured()) {
      return reply.status(503).send({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Cloudflare R2 storage credentials are not configured on server'
      });
    }

    try {
      const uploadResult = await uploadProductImageToR2(buffer, shopId);
      return reply.status(201).send({
        statusCode: 201,
        message: 'Product image uploaded to Cloudflare R2 successfully',
        url: uploadResult.url,
        key: uploadResult.key,
        size: uploadResult.size,
        mimeType: uploadResult.mimeType,
        originalSize: uploadResult.originalSize,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Storage upload error';
      request.log.error({ err }, 'Failed to upload product image to R2');

      const isClientError = msg.includes('compression failed') ||
        msg.includes('25 megapixels') ||
        msg.includes('dimensions') ||
        msg.includes('corrupt') ||
        msg.includes('Invalid');

      if (isClientError) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: msg
        });
      }

      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: `Failed to upload image to storage: ${msg}`
      });
    }
  });

  /**
   * DELETE /api/v1/vendor/upload
   * Authorized cleanup of an orphaned uploaded image in Cloudflare R2
   * Strictly scoped to the vendor's own shop prefix
   */
  fastify.delete('/upload', async (request: FastifyRequest<{ Body: { key?: string } }>, reply: FastifyReply) => {
    const shopId = await resolveVendorShopId(request);
    if (!shopId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'No active shop associated with this vendor account or permissions revoked'
      });
    }

    const { key } = (request.body as { key?: string }) || {};
    if (!key || typeof key !== 'string') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Object key is required for deletion'
      });
    }

    // Strict multi-tenant safety and path traversal validation
    const keyValidation = isValidProductImageKey(key, shopId);
    if (!keyValidation.isValid) {
      const isForbidden = keyValidation.error?.includes('outside');
      return reply.status(isForbidden ? 403 : 400).send({
        statusCode: isForbidden ? 403 : 400,
        error: isForbidden ? 'Forbidden' : 'Bad Request',
        message: keyValidation.error || 'Invalid object key'
      });
    }

    if (!isR2Configured()) {
      return reply.status(503).send({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Cloudflare R2 storage credentials are not configured on server'
      });
    }

    try {
      await deleteProductImageFromR2(key);
      return reply.status(200).send({
        statusCode: 200,
        message: 'Product image deleted successfully from Cloudflare R2',
        key
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Storage deletion error';
      request.log.error({ err }, 'Failed to delete product image from R2');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: `Failed to delete image from storage: ${msg}`
      });
    }
  });
};


