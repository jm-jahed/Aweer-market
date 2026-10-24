import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@aweermarket/types';
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
  findShopById
} from '../models/shop.model.js';
import {
  listAllProductsAdmin,
  countProducts,
  setProductActiveStatus,
  findProductById
} from '../models/product.model.js';
import { countOrders } from '../models/order.model.js';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // All admin routes strictly require Super Admin authentication
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole(UserRole.SUPER_ADMIN));

  /**
   * GET /api/v1/admin/overview
   * Real platform metrics and counters across users, stalls, products, and orders.
   */
  fastify.get('/overview', async (_request: FastifyRequest, reply: FastifyReply) => {
    const [userCounts, shopCounts, productCounts, orderCount] = await Promise.all([
      countUsers(),
      countShops(),
      countProducts(),
      countOrders()
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
        totalOrders: orderCount
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
    const updated = await findShopById(id);

    return reply.status(200).send({
      statusCode: 200,
      message: body.isApproved ? 'Shop approved successfully' : 'Shop approval revoked / suspended',
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
};
