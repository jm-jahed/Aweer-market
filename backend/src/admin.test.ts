/**
 * AweerMarket Super Admin Governance & Access Integration Tests
 * Uses native Node.js test runner (node --test) with Fastify inject.
 * Verifies Super Admin authentication, role isolation, shop approval workflows,
 * user status management, product moderation, and self-deactivation protection.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { UserRole, ProductCategory, WholesaleUnit } from '@aweermarket/types';
import { buildServer } from './server.js';
import { hashPassword, signSessionToken } from './utils/crypto.js';
import { getSecretForRole } from './plugins/security.js';
import {
  createSuperAdminUser,
  createBuyerUser,
  resetInMemoryUsers,
  findUserByEmail
} from './models/user.model.js';
import { createShop, resetInMemoryShops, findShopById } from './models/shop.model.js';
import { createProduct, resetInMemoryProducts, findProductById } from './models/product.model.js';
import { resetInMemoryOrders } from './models/order.model.js';

describe('AweerMarket Step 3 — Super Admin Foundation', () => {
  let server: FastifyInstance;
  let superAdminToken: string;
  let buyerToken: string;
  let superAdminId: string;
  let buyerId: string;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    resetInMemoryUsers();
    resetInMemoryShops();
    resetInMemoryProducts();
    resetInMemoryOrders();

    server = await buildServer();
    await server.ready();

    // 1. Seed Super Admin account
    const superAdminHash = await hashPassword('SuperAdminPass123!');
    const superAdmin = await createSuperAdminUser({
      email: 'owner@aweermarket.ae',
      passwordHash: superAdminHash,
      fullName: 'Chief Market Administrator'
    });
    superAdminId = superAdmin.id;
    superAdminToken = signSessionToken(
      {
        userId: superAdmin.id,
        role: UserRole.SUPER_ADMIN,
        email: superAdmin.email
      },
      getSecretForRole(UserRole.SUPER_ADMIN)
    );

    // 2. Seed Buyer account
    const buyerHash = await hashPassword('BuyerPassword123!');
    const buyer = await createBuyerUser({
      email: 'buyer@restaurant.ae',
      passwordHash: buyerHash,
      fullName: 'Chef Tariq'
    });
    buyerId = buyer.id;
    buyerToken = signSessionToken(
      {
        userId: buyer.id,
        role: UserRole.BUYER,
        email: buyer.email
      },
      getSecretForRole(UserRole.BUYER)
    );
  });

  afterEach(async () => {
    await server.close();
  });

  // ==========================================================================
  // 1. Super Admin Authentication (POST /auth/super-admin/login)
  // ==========================================================================
  describe('1. Super Admin Authentication', () => {
    it('authenticates valid Super Admin credentials and sets role-bound session cookie', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/super-admin/login',
        payload: {
          email: 'owner@aweermarket.ae',
          password: 'SuperAdminPass123!'
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.statusCode, 200);
      assert.strictEqual(body.user.role, 'super_admin');
      assert.strictEqual(body.user.email, 'owner@aweermarket.ae');

      const setCookie = res.headers['set-cookie'] as string;
      assert.ok(setCookie);
      assert.match(setCookie, /aweer_session=/);
      assert.match(setCookie, /HttpOnly/i);
    });

    it('rejects wrong password with 401 Unauthorized', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/super-admin/login',
        payload: {
          email: 'owner@aweermarket.ae',
          password: 'WrongPassword999!'
        }
      });

      assert.strictEqual(res.statusCode, 401);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /invalid email or password/i);
    });

    it('REJECTS non-super-admin user attempting super admin login (Role Enforcement)', async () => {
      // Buyer attempting to login via Super Admin portal
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/super-admin/login',
        payload: {
          email: 'buyer@restaurant.ae',
          password: 'BuyerPassword123!'
        }
      });

      assert.strictEqual(res.statusCode, 401);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /invalid email or password/i);
    });

    it('restores Super Admin session via GET /auth/super-admin/me', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/super-admin/me',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.user.role, 'super_admin');
      assert.strictEqual(body.user.email, 'owner@aweermarket.ae');
    });

    it('rejects Buyer token from accessing GET /auth/super-admin/me', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/auth/super-admin/me',
        headers: {
          cookie: `aweer_session=${buyerToken}`
        }
      });

      assert.strictEqual(res.statusCode, 401);
    });
  });

  // ==========================================================================
  // 2. Role-Based Access Control on /api/v1/admin/*
  // ==========================================================================
  describe('2. Admin Endpoints Access Control', () => {
    it('rejects unauthenticated request to /admin/overview with 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/overview'
      });

      assert.strictEqual(res.statusCode, 401);
    });

    it('STRICTLY REJECTS Buyer token from /admin/overview with 403 Forbidden', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
        headers: {
          cookie: `aweer_session=${buyerToken}`
        }
      });

      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /insufficient permissions/i);
    });

    it('permits Super Admin to view /admin/overview with accurate real metrics', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.metrics.totalUsers, 2);
      assert.strictEqual(body.metrics.buyers, 1);
      assert.strictEqual(body.metrics.superAdmins, 1);
    });
  });

  // ==========================================================================
  // 3. Vendor / Shop Approval Workflow (PATCH /admin/shops/:id/approval)
  // ==========================================================================
  describe('3. Shop Approval Workflow', () => {
    let pendingShopId: string;

    beforeEach(async () => {
      const shop = await createShop({
        name: 'Fresh Dates Oasis LLC',
        stallNumber: 'Block C, Stall 09',
        ownerId: 'usr_vendor_99',
        tradeLicenseNumber: 'TL-999888',
        phone: '+971509988776',
        isApproved: false // Pending approval
      });
      pendingShopId = shop.id;
    });

    it('lists shops with approval filter', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/shops?status=pending',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.shops.length, 1);
      assert.strictEqual(body.shops[0].name, 'Fresh Dates Oasis LLC');
      assert.strictEqual(body.shops[0].isApproved, false);
    });

    it('approves a pending stall and confirms updated state', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/api/v1/admin/shops/${pendingShopId}/approval`,
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          isApproved: true
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.shop.isApproved, true);

      // Verify persisted state
      const verified = await findShopById(pendingShopId);
      assert.strictEqual(verified?.isApproved, true);
    });

    it('suspends an approved stall (revokes approval)', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/api/v1/admin/shops/${pendingShopId}/approval`,
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          isApproved: false
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.shop.isApproved, false);
    });
  });

  // ==========================================================================
  // 4. User Status Management & Safety Controls
  // ==========================================================================
  describe('4. User Governance & Safety Controls', () => {
    it('suspends a user account and prevents subsequent login', async () => {
      // 1. Suspend buyer account
      const res = await server.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${buyerId}/status`,
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          isActive: false
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.user.isActive, false);

      // 2. Buyer attempts login -> gets 403 Forbidden
      const loginRes = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'buyer@restaurant.ae',
          password: 'BuyerPassword123!'
        }
      });
      assert.strictEqual(loginRes.statusCode, 403);
    });

    it('PREVENTS Super Admin from deactivating their own active account', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${superAdminId}/status`,
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          isActive: false
        }
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /cannot deactivate their own/i);
    });
  });

  // ==========================================================================
  // 5. Product Moderation Workflow
  // ==========================================================================
  describe('5. Product Moderation', () => {
    let productId: string;

    beforeEach(async () => {
      const prod = await createProduct({
        name: 'Suspect Wholesale Apples',
        category: ProductCategory.FRESH_FRUITS,
        originCountry: 'Unknown',
        description: 'Listing pending moderation',
        offers: [
          {
            shopId: 'shop_1',
            shopName: 'Test Stall',
            unit: WholesaleUnit.CARTON,
            unitWeightKg: 10,
            priceAed: 50,
            availableStock: 20
          }
        ]
      });
      productId = prod.id;
    });

    it('delists/moderates an active product listing', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/api/v1/admin/products/${productId}/moderation`,
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          isActive: false
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.message, 'Product delisted and moderated');

      // Delisted product is omitted from public catalog
      const catalogRes = await server.inject({
        method: 'GET',
        url: '/api/v1/products'
      });
      const catalogBody = JSON.parse(catalogRes.payload);
      assert.strictEqual(catalogBody.products.length, 0);
    });
  });
});
