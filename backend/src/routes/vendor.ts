import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@aweermarket/types';
import { UpdateShopProfileSchema, CreateProductSchema, UpdateProductOfferSchema } from '@aweermarket/validation';
import { authenticate, requireRole } from '../plugins/security.js';
import { findShopById, findShopByOwnerId, updateShop } from '../models/shop.model.js';
import { findUserById } from '../models/user.model.js';
import {
  findProductByName,
  findProductById,
  createProduct,
  addOrUpdateProductOffer,
  updateProductOffer,
  listProductsByVendor
} from '../models/product.model.js';

export const vendorRoutes: FastifyPluginAsync = async (fastify) => {
  // All vendor routes require valid authentication and SHOP_ADMIN (or legacy VENDOR) role
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole(UserRole.SHOP_ADMIN));

  /**
   * Helper to resolve the authenticated vendor's shop ID securely.
   */
  async function resolveVendorShopId(request: FastifyRequest): Promise<string | null> {
    if (request.user?.shopId) {
      return request.user.shopId;
    }
    if (request.user?.userId) {
      const dbUser = await findUserById(request.user.userId);
      if (dbUser?.shopId) {
        return dbUser.shopId;
      }
      const shop = await findShopByOwnerId(request.user.userId);
      if (shop) {
        return shop.id;
      }
    }
    return null;
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

    const { name, category, originCountry, description, offer } = parseResult.data;

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
};

