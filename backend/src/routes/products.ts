import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { ProductCategory } from '@aweermarket/types';
import { findProducts, findProductById, listProductsByVendor } from '../models/product.model.js';
import { findShopById, listAllShops } from '../models/shop.model.js';
import { listAllCategories } from '../models/category.model.js';

export const productsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/categories
   * Returns supported wholesale produce categories and descriptive labels.
   */
  fastify.get('/categories', async (_request: FastifyRequest, reply: FastifyReply) => {
    const categories = await listAllCategories({ isActive: true });

    return reply.status(200).send({
      statusCode: 200,
      categories
    });
  });

  /**
   * GET /api/v1/products
   * Public wholesale catalog browsing, category filtering, search, and AED/kg comparison.
   */
  fastify.get('/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      category?: string;
      search?: string;
      originCountry?: string;
      page?: string;
      limit?: string;
    };

    let categoryFilter: ProductCategory | undefined;
    if (query.category) {
      const activeCats = await listAllCategories({ isActive: true });
      const validCategoryKeys = Array.from(new Set([
        ...Object.values(ProductCategory) as string[],
        ...activeCats.map((c) => c.key)
      ]));

      if (!validCategoryKeys.includes(query.category)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Invalid produce category '${query.category}'. Must be one of: ${validCategoryKeys.join(', ')}`
        });
      }
      categoryFilter = query.category as ProductCategory;
    }

    const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10) || 20));

    const { products, total } = await findProducts({
      category: categoryFilter,
      search: query.search,
      originCountry: query.originCountry,
      page,
      limit
    });

    const publicProducts = products.map((p) => p.toPublicProductItem());

    return reply.status(200).send({
      statusCode: 200,
      products: publicProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  });

  /**
   * GET /api/v1/products/:id
   * Public product details showing multi-stall offers and wholesale stock.
   */
  fastify.get('/products/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    if (!id || id.trim().length === 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Product ID is required'
      });
    }

    const product = await findProductById(id.trim());
    if (!product || !product.isActive) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Product not found or currently unavailable'
      });
    }

    return reply.status(200).send({
      statusCode: 200,
      product: product.toPublicProductItem()
    });
  });

  /**
   * GET /api/v1/shops
   * Public list of approved, active wholesale stalls at Al Aweer.
   */
  fastify.get('/shops', async (_request: FastifyRequest, reply: FastifyReply) => {
    const shops = await listAllShops({ isApproved: true });
    const activeShops = shops.filter((s) => s.isActive).map((s) => s.toPublicSummary());

    return reply.status(200).send({
      statusCode: 200,
      shops: activeShops
    });
  });

  /**
   * GET /api/v1/shops/:id
   * Public storefront for an approved stall, returning stall info and its active produce offers.
   */
  fastify.get('/shops/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    if (!id || id.trim().length === 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Shop ID is required'
      });
    }

    const shop = await findShopById(id.trim());
    if (!shop || !shop.isActive || !shop.isApproved) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Shop not found or not approved for public storefront listing'
      });
    }

    const rawProducts = await listProductsByVendor(shop.id);
    const shopProducts = rawProducts
      .filter((p) => p.isActive)
      .map((p) => {
        const item = p.toPublicProductItem();
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          originCountry: item.originCountry,
          description: item.description,
          imageUrl: item.imageUrl,
          offers: item.offers.filter((o) => o.vendorId === shop.id)
        };
      })
      .filter((p) => p.offers.length > 0);

    return reply.status(200).send({
      statusCode: 200,
      shop: shop.toPublicSummary(),
      products: shopProducts
    });
  });
};

