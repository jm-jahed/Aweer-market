import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { UserRole, OrderStatus, isAdministrativeRole } from '@aweermarket/types';
import { authenticate, requireRole } from '../plugins/security.js';
import {
  listAllUsers,
  countUsers,
  setUserActiveStatus,
  findUserById,
  findUserByEmail,
  createShopAdminUser,
  upsertResellerUser,
  updateUserCredentialsForReseller
} from '../models/user.model.js';
import { hashPassword } from '../utils/crypto.js';
import {
  listAllShops,
  countShops,
  createShop,
  updateShop,
  deleteShop,
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
import {
  listAllResellers,
  findResellerById,
  createReseller,
  updateReseller,
  setResellerStatus,
  deleteReseller,
  countResellers,
  DatabaseUnavailableError
} from '../models/reseller.model.js';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CreateResellerSchema,
  UpdateResellerSchema,
  CreateShopByAdminSchema,
  UpdateShopByAdminSchema
} from '@aweermarket/validation';


/**
 * PreHandler hook: Live Admin database verification.
 * Enforces that the authenticated user:
 * 1. Authoritatively exists in the database.
 * 2. Has active account status (isActive === true).
 * 3. Currently holds the database role of SUPER_ADMIN or RESELLER.
 * Stale JWT tokens from deactivated or demoted accounts are rejected.
 */
export async function requireActiveAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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
      message: 'Administrative account not found'
    });
  }

  if (!dbUser.isActive) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Administrative account has been deactivated'
    });
  }

  if (dbUser.role !== UserRole.SUPER_ADMIN && dbUser.role !== UserRole.RESELLER) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Access denied: insufficient permissions'
    });
  }
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Administrative routes require valid session token, administrative role (Super Admin or Reseller), and active DB record
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole(UserRole.SUPER_ADMIN, UserRole.RESELLER));
  fastify.addHook('preHandler', requireActiveAdmin);

  /**
   * GET /api/v1/admin/overview
   * Real platform metrics and counters across users, stalls, products, and orders.
   * Strictly scopes metrics to owned stalls for RESELLER, while preserving platform-wide overview for SUPER_ADMIN.
   */
  fastify.get('/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user?.role === UserRole.RESELLER) {
      const resellerId = request.user.resellerId;
      const myShops = await listAllShops({ resellerId });
      const shopIds = myShops.map((s) => s.id);

      const [userCounts, shopCounts, productCounts, orderCount, financials] = await Promise.all([
        countUsers({ resellerId, shopIds }),
        countShops({ resellerId }),
        countProducts({ shopIds }),
        countOrders({ shopIds }),
        getOrderFinancialMetrics({ shopIds })
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
          totalResellers: 0,
          approvedResellers: 0,
          pendingResellers: 0,
          financials
        }
      });
    }

    const [userCounts, shopCounts, productCounts, orderCount, financials, resellerCounts] = await Promise.all([
      countUsers(),
      countShops(),
      countProducts(),
      countOrders(),
      getOrderFinancialMetrics(),
      countResellers().catch((err: any) => {
        if (err instanceof DatabaseUnavailableError || err.statusCode === 503) {
          return { total: 0, approved: 0, pending: 0, suspended: 0 };
        }
        throw err;
      })
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
        totalResellers: resellerCounts.total,
        approvedResellers: resellerCounts.approved,
        pendingResellers: resellerCounts.pending,
        financials
      }
    });
  });

  /**
   * GET /api/v1/admin/shops
   * Lists wholesale vendor stalls with approval, active, and reseller tenant scoping.
   */
  fastify.get('/shops', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: string };
    const filter: { isApproved?: boolean; resellerId?: string } = {};

    if (query.status === 'approved') {
      filter.isApproved = true;
    } else if (query.status === 'pending') {
      filter.isApproved = false;
    }

    // Multi-Tenant Isolation: Resellers strictly see only their own affiliated stalls
    if (request.user?.role === UserRole.RESELLER) {
      filter.resellerId = request.user.resellerId;
    }

    const shops = await listAllShops(filter);
    return reply.status(200).send({
      statusCode: 200,
      shops: shops.map((s) => s.toPublicSummary())
    });
  });

  /**
   * POST /api/v1/admin/shops
   * Admin or Reseller registers a wholesale vendor stall and provisions login credentials.
   */
  fastify.post('/shops', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateShopByAdminSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Invalid vendor stall input'
      });
    }

    const { name, stallNumber, ownerName, email, password, phone, tradeLicenseNumber, marketLocation, description, openingHours } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Verify account email uniqueness
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'An account with this email address already exists'
      });
    }

    // Securely hash vendor portal password
    const passwordHash = await hashPassword(password);

    // Multi-tenant isolation tag: If created by Reseller, associate with resellerId
    const resellerId = request.user?.role === UserRole.RESELLER ? request.user.resellerId : undefined;

    let createdShop: any = null;
    try {
      const tempOwnerId = `pending_owner_${Date.now()}`;
      createdShop = await createShop({
        name,
        stallNumber,
        ownerId: tempOwnerId,
        resellerId,
        tradeLicenseNumber,
        phone,
        isApproved: true,
        isActive: true
      });

      const vendorUser = await createShopAdminUser({
        email: normalizedEmail,
        passwordHash,
        fullName: ownerName,
        phone,
        shopId: createdShop.id,
        resellerId,
        tradeLicenseNumber
      });

      // Update shop with authoritative owner ID
      await updateShop(createdShop.id, { ownerId: vendorUser.id });
      if (createdShop.ownerId !== undefined) {
        createdShop.ownerId = vendorUser.id;
      }

      return reply.status(201).send({
        statusCode: 201,
        message: 'Vendor stall and portal login registered successfully',
        shop: createdShop.toPublicSummary(),
        vendor: vendorUser.toUserSummary()
      });
    } catch (err: any) {
      // Compensating rollback: Clean up orphaned shop if vendor user creation failed
      if (createdShop?.id) {
        try {
          await deleteShop(createdShop.id);
        } catch (cleanupErr) {
          request.log.error({ cleanupErr, shopId: createdShop.id }, 'Failed to rollback orphaned shop after vendor creation failure');
        }
      }

      if (err.statusCode === 409 || err.code === 11000) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'A shop or user with this name or email already exists'
        });
      }
      if (err instanceof DatabaseUnavailableError || err.statusCode === 503) {
        return reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Database storage is unavailable. Stall creation rejected.'
        });
      }
      throw err;
    }
  });

  /**
   * PUT /api/v1/admin/shops/:id
   * Admin or Reseller updates authorized stall metadata.
   * Enforces server-side tenant isolation: Resellers can only edit their own stalls.
   */
  fastify.put('/shops/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = UpdateShopByAdminSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Invalid shop update payload'
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

    // Security: Enforce reseller tenant isolation
    if (request.user?.role === UserRole.RESELLER && shop.resellerId !== request.user.resellerId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: You cannot edit vendor stalls belonging to another reseller'
      });
    }

    try {
      const updated = await updateShop(id, parseResult.data);
      return reply.status(200).send({
        statusCode: 200,
        message: 'Shop metadata updated successfully',
        shop: updated ? updated.toPublicSummary() : null
      });
    } catch (err: any) {
      if (err instanceof DatabaseUnavailableError || err.statusCode === 503) {
        return reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Database storage is unavailable. Stall update rejected.'
        });
      }
      throw err;
    }
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

    // Security: Enforce reseller tenant isolation
    if (request.user?.role === UserRole.RESELLER && shop.resellerId !== request.user.resellerId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: You cannot manage vendor stalls belonging to another reseller'
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

    // Security: Enforce reseller tenant isolation
    if (request.user?.role === UserRole.RESELLER && shop.resellerId !== request.user.resellerId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: You cannot manage vendor stalls belonging to another reseller'
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

    let scopedShopIds: string[] | undefined;
    if (request.user?.role === UserRole.RESELLER) {
      const myShops = await listAllShops({ resellerId: request.user.resellerId });
      scopedShopIds = myShops.map((s) => s.id);
    }

    const [orders, financials] = await Promise.all([
      listAllOrdersAdmin({
        status: statusFilter,
        shopId: query.shopId?.trim(),
        shopIds: scopedShopIds
      }),
      getOrderFinancialMetrics(scopedShopIds ? { shopIds: scopedShopIds } : undefined)
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

  /**
   * GET /api/v1/admin/resellers
   * Lists commercial produce resellers and sub-distributors with status and tier filters.
   * Strictly restricted to SUPER_ADMIN (Resellers cannot manage or view other resellers).
   */
  fastify.get('/resellers', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user?.role !== UserRole.SUPER_ADMIN) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: Resellers cannot view or manage other reseller accounts'
      });
    }

    const query = request.query as { status?: string; tier?: string };
    try {
      const resellers = await listAllResellers({
        status: query.status?.trim(),
        tier: query.tier?.trim()
      });
      return reply.status(200).send({
        statusCode: 200,
        resellers
      });
    } catch (err: any) {
      if (err instanceof DatabaseUnavailableError || err.statusCode === 503) {
        return reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Database service is unavailable. Reseller data cannot be retrieved.'
        });
      }
      throw err;
    }
  });

  /**
   * POST /api/v1/admin/resellers
   * Registers a new commercial reseller or wholesale sub-distributor.
   * Strictly restricted to SUPER_ADMIN.
   */
  fastify.post('/resellers', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user?.role !== UserRole.SUPER_ADMIN) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: Resellers cannot create other reseller accounts'
      });
    }

    const parseResult = CreateResellerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Invalid reseller input'
      });
    }

    try {
      const reseller = await createReseller(parseResult.data);

      // If an initial password was provided, provision the RESELLER administrative user account
      // so the reseller can log in immediately to their management portal.
      if (parseResult.data.password) {
        const passwordHash = await hashPassword(parseResult.data.password);
        await upsertResellerUser({
          email: reseller.email,
          passwordHash,
          fullName: reseller.contactPerson,
          phone: reseller.phone,
          businessName: reseller.businessName,
          tradeLicenseNumber: reseller.tradeLicenseNumber,
          resellerId: reseller.id
        });
      }

      return reply.status(201).send({
        statusCode: 201,
        message: 'Reseller account registered successfully',
        reseller
      });
    } catch (err: any) {
      if (err.statusCode === 409) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: err.message
        });
      }
      if (err instanceof DatabaseUnavailableError || err.statusCode === 503) {
        return reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Persistent database storage is unavailable. Reseller creation rejected.'
        });
      }
      throw err;
    }
  });

  /**
   * PUT /api/v1/admin/resellers/:id
   * Updates commercial reseller profile, credit limits, discount rates, and terms.
   */
  fastify.put('/resellers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user?.role !== UserRole.SUPER_ADMIN) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: Resellers cannot update other reseller accounts'
      });
    }

    const { id } = request.params as { id: string };
    const parseResult = UpdateResellerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors[0]?.message || 'Invalid reseller update input'
      });
    }

    try {
      const existing = await findResellerById(id);
      const updated = await updateReseller(id, parseResult.data);
      if (!updated) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Reseller not found'
        });
      }

      // If password or profile data updated, update user credentials as well
      if (parseResult.data.password || parseResult.data.email || parseResult.data.contactPerson) {
        let passwordHash: string | undefined;
        if (parseResult.data.password) {
          passwordHash = await hashPassword(parseResult.data.password);
        }
        await updateUserCredentialsForReseller(existing?.email || updated.email, {
          email: updated.email,
          passwordHash,
          fullName: updated.contactPerson,
          phone: updated.phone,
          businessName: updated.businessName,
          tradeLicenseNumber: updated.tradeLicenseNumber
        });
      }

      return reply.status(200).send({
        statusCode: 200,
        message: 'Reseller details updated successfully',
        reseller: updated
      });
    } catch (err: any) {
      if (err.statusCode === 409) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: err.message
        });
      }
      if (err instanceof DatabaseUnavailableError || err.statusCode === 503) {
        return reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Persistent database storage is unavailable. Reseller update rejected.'
        });
      }
      throw err;
    }
  });

  /**
   * PATCH /api/v1/admin/resellers/:id/status
   * Approves, suspends, or updates reseller partnership status.
   */
  fastify.patch('/resellers/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user?.role !== UserRole.SUPER_ADMIN) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: Resellers cannot modify reseller partnership status'
      });
    }

    const { id } = request.params as { id: string };
    const body = request.body as { status?: string };

    if (!body?.status || !['pending', 'approved', 'suspended', 'rejected'].includes(body.status)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: "Property 'status' must be one of: pending, approved, suspended, rejected"
      });
    }

    try {
      const updated = await setResellerStatus(id, body.status);
      if (!updated) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Reseller not found'
        });
      }

      return reply.status(200).send({
        statusCode: 200,
        message: `Reseller status updated to '${body.status}'`,
        reseller: updated
      });
    } catch (err: any) {
      if (err instanceof DatabaseUnavailableError || err.statusCode === 503) {
        return reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Persistent database storage is unavailable. Reseller status update rejected.'
        });
      }
      throw err;
    }
  });

  /**
   * DELETE /api/v1/admin/resellers/:id
   * Removes reseller account if there is no outstanding credit balance.
   */
  fastify.delete('/resellers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user?.role !== UserRole.SUPER_ADMIN) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: Resellers cannot delete reseller accounts'
      });
    }

    const { id } = request.params as { id: string };
    try {
      const result = await deleteReseller(id);

      if (!result.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: result.message || 'Could not delete reseller'
        });
      }

      return reply.status(200).send({
        statusCode: 200,
        message: 'Reseller account deleted successfully'
      });
    } catch (err: any) {
      if (err instanceof DatabaseUnavailableError || err.statusCode === 503) {
        return reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Persistent database storage is unavailable. Reseller deletion rejected.'
        });
      }
      throw err;
    }
  });
};
