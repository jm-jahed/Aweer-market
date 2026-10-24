/**
 * AweerMarket Super Admin Governance & Access Integration Tests
 * Uses native Node.js test runner (node --test) with Fastify inject.
 * Verifies Super Admin authentication, role isolation, shop approval workflows,
 * user status management, product moderation, and self-deactivation protection.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { UserRole, ProductCategory, WholesaleUnit, DeliveryType } from '@aweermarket/types';
import { buildServer } from './server.js';
import { hashPassword, signSessionToken } from './utils/crypto.js';
import { getSecretForRole } from './plugins/security.js';
import {
  createSuperAdminUser,
  createBuyerUser,
  resetInMemoryUsers,
  findUserByEmail,
  findUserById,
  setUserActiveStatus
} from './models/user.model.js';
import { createShop, resetInMemoryShops, findShopById } from './models/shop.model.js';
import { createProduct, resetInMemoryProducts, findProductById } from './models/product.model.js';
import { resetInMemoryOrders, createOrderRecord } from './models/order.model.js';

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

    // ========================================================================
    // Phase 3.1: SuperAdmin Live Database Account Verification
    // ========================================================================
    it('permits active SuperAdmin with a valid token to access an authorized admin endpoint', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/shops',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.statusCode, 200);
      assert.ok(Array.isArray(body.shops));
    });

    it('DENIES inactive SuperAdmin with a previously valid token (403 Forbidden)', async () => {
      // Deactivate the super admin account in the database
      const updated = await setUserActiveStatus(superAdminId, false);
      assert.strictEqual(updated, true);

      // Attempt to access admin routes with the previously issued token
      const resOverview = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        }
      });

      assert.strictEqual(resOverview.statusCode, 403);
      const bodyOverview = JSON.parse(resOverview.payload);
      assert.match(bodyOverview.message, /deactivated/i);

      // Also verify another privileged route (/admin/shops)
      const resShops = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/shops',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        }
      });
      assert.strictEqual(resShops.statusCode, 403);
    });

    it('DENIES user whose role changed from SUPER_ADMIN in the database (403 Forbidden)', async () => {
      // Change the user's role in the database to BUYER
      const adminUser = await findUserById(superAdminId);
      assert.ok(adminUser);
      (adminUser as any).role = UserRole.BUYER;

      // Attempt to access admin route with original SuperAdmin token
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        }
      });

      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /insufficient permissions/i);
    });

    it('DENIES token with missing or deleted database user (401 Unauthorized)', async () => {
      // Sign a validly cryptographically signed SuperAdmin token for a non-existent user
      const ghostToken = signSessionToken(
        {
          userId: 'deleted_or_missing_user_id_999',
          role: UserRole.SUPER_ADMIN,
          email: 'ghost@aweermarket.ae'
        },
        getSecretForRole(UserRole.SUPER_ADMIN)
      );

      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
        headers: {
          cookie: `aweer_session=${ghostToken}`
        }
      });

      assert.strictEqual(res.statusCode, 401);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /not found/i);
    });

    it('DENIES non-SuperAdmin accounts across multiple privileged admin routes (403 Forbidden)', async () => {
      const endpoints = [
        { method: 'GET' as const, url: '/api/v1/admin/overview' },
        { method: 'GET' as const, url: '/api/v1/admin/shops' },
        { method: 'GET' as const, url: '/api/v1/admin/users' },
        { method: 'GET' as const, url: '/api/v1/admin/products' },
        { method: 'GET' as const, url: '/api/v1/admin/orders' },
        { method: 'GET' as const, url: '/api/v1/admin/categories' }
      ];

      for (const ep of endpoints) {
        const res = await server.inject({
          method: ep.method,
          url: ep.url,
          headers: {
            cookie: `aweer_session=${buyerToken}`
          }
        });
        assert.strictEqual(res.statusCode, 403, `Expected 403 for ${ep.url}`);
      }
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

  // ==========================================================================
  // 6. Super Admin Order Oversight, Commissions & Stall Delisting (Step 9)
  // ==========================================================================
  describe('6. Order Oversight, Commissions & Delisting Cascade', () => {
    let testShopId: string;
    let testProductId: string;

    beforeEach(async () => {
      const shop = await createShop({
        name: 'Delistable Dates Stall',
        stallNumber: 'ST-99',
        ownerId: 'owner_99',
        phone: '+971509999999',
        tradeLicenseNumber: 'TL-99999'
      });
      testShopId = shop.id;

      const prod = await createProduct({
        name: 'Medjool Dates Box',
        category: ProductCategory.FRESH_FRUITS,
        originCountry: 'UAE',
        description: 'Premium Medjool Dates',
        offers: [
          {
            shopId: testShopId,
            shopName: 'Delistable Dates Stall',
            stallNumber: 'ST-99',
            unit: WholesaleUnit.BOX,
            unitWeightKg: 5,
            priceAed: 100,
            availableStock: 50
          }
        ]
      });
      testProductId = prod.id;

      // Seed an order
      await createOrderRecord({
        buyerId,
        shopId: testShopId,
        shopName: 'Delistable Dates Stall',
        stallNumber: 'ST-99',
        deliveryType: DeliveryType.SCHEDULED_DELIVERY,
        deliveryAddress: 'Bur Dubai Hotel 5',
        items: [
          {
            productId: testProductId,
            name: 'Medjool Dates Box',
            unit: WholesaleUnit.BOX,
            unitWeightKg: 5,
            quantity: 2,
            unitPriceAed: 100
          }
        ]
      });
    });

    it('returns platform-wide orders with 5% marketplace commission calculation', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/orders',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.statusCode, 200);
      assert.strictEqual(body.orders.length, 1);
      assert.strictEqual(body.orders[0].totalAmountAed, 200);
      assert.strictEqual(body.orders[0].commissionAed, 10); // 5% of 200 = 10 AED
      assert.strictEqual(body.financials.totalGmvAed, 200);
      assert.strictEqual(body.financials.totalCommissionAed, 10);
    });

    it('enriches GET /admin/overview with GMV and commission metrics', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.metrics.financials.totalGmvAed, 200);
      assert.strictEqual(body.metrics.financials.totalCommissionAed, 10);
      assert.strictEqual(body.metrics.financials.commissionRatePercent, 5);
    });

    it('suspends stall and delists its offers from the marketplace catalog', async () => {
      // 1. Initial catalog check: product offer is visible
      const catalogBefore = await server.inject({
        method: 'GET',
        url: `/api/v1/products/${testProductId}`
      });
      assert.strictEqual(catalogBefore.statusCode, 200);
      const beforeBody = JSON.parse(catalogBefore.payload);
      assert.strictEqual(beforeBody.product.offers.length, 1);

      // 2. Super Admin suspends the stall
      const suspendRes = await server.inject({
        method: 'PATCH',
        url: `/api/v1/admin/shops/${testShopId}/status`,
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          isActive: false
        }
      });
      assert.strictEqual(suspendRes.statusCode, 200);

      // 3. Delisted stall offers are immediately omitted from the catalog
      const catalogAfter = await server.inject({
        method: 'GET',
        url: `/api/v1/products/${testProductId}`
      });
      assert.strictEqual(catalogAfter.statusCode, 200);
      const afterBody = JSON.parse(catalogAfter.payload);
      assert.strictEqual(afterBody.product.offers.length, 0);
    });
  });

  // ============================================================================
  // 8. Super Admin Category Management (CRUD & Public Sync)
  // ============================================================================
  describe('8. Super Admin Category Management', () => {
    let createdCatId: string;

    it('REJECTS non-super-admin access to /api/v1/admin/categories', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/categories',
        headers: {
          cookie: `aweer_session=${buyerToken}`
        }
      });
      assert.strictEqual(res.statusCode, 403);
    });

    it('allows Super Admin to list all categories via GET /api/v1/admin/categories', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/categories',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        }
      });
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.ok(Array.isArray(body.categories));
      assert.ok(body.categories.length >= 7);
      assert.ok(body.categories.some((c: any) => c.key === 'fresh_fruits'));
    });

    it('creates a new wholesale produce category via POST /api/v1/admin/categories', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/admin/categories',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          name: 'Dates & Dry Fruits',
          slug: 'dates_dry_fruits',
          description: 'Premium Medjool and Arabian dates sourced directly from Al Aweer.',
          icon: '🌴',
          sortOrder: 8,
          isActive: true
        }
      });
      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.category.key, 'dates_dry_fruits');
      assert.strictEqual(body.category.label, 'Dates & Dry Fruits');
      createdCatId = body.category.id;
      assert.ok(createdCatId);
    });

    it('REJECTS duplicate category slug with 409 Conflict', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/admin/categories',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          name: 'Duplicate Dates',
          slug: 'dates_dry_fruits'
        }
      });
      assert.strictEqual(res.statusCode, 409);
    });

    it('updates an existing category via PUT /api/v1/admin/categories/:id', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/admin/categories/${createdCatId}`,
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          name: 'Emirati Dates & Dry Fruits',
          icon: '🥥',
          sortOrder: 10
        }
      });
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.category.label, 'Emirati Dates & Dry Fruits');
      assert.strictEqual(body.category.icon, '🥥');
      assert.strictEqual(body.category.sortOrder, 10);
    });

    it('public GET /api/v1/categories returns newly created active category', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/categories'
      });
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      const found = body.categories.find((c: any) => c.key === 'dates_dry_fruits');
      assert.ok(found);
      assert.strictEqual(found.label, 'Emirati Dates & Dry Fruits');
    });

    it('deactivates category via PATCH /api/v1/admin/categories/:id/status and verifies exclusion from public listing', async () => {
      const patchRes = await server.inject({
        method: 'PATCH',
        url: `/api/v1/admin/categories/${createdCatId}/status`,
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          isActive: false
        }
      });
      assert.strictEqual(patchRes.statusCode, 200);
      const patchBody = JSON.parse(patchRes.payload);
      assert.strictEqual(patchBody.category.isActive, false);

      // Public listing should exclude inactive category
      const publicRes = await server.inject({
        method: 'GET',
        url: '/api/v1/categories'
      });
      assert.strictEqual(publicRes.statusCode, 200);
      const publicBody = JSON.parse(publicRes.payload);
      const found = publicBody.categories.find((c: any) => c.key === 'dates_dry_fruits');
      assert.strictEqual(found, undefined);
    });

    it('deletes unused category via DELETE /api/v1/admin/categories/:id', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/v1/admin/categories/${createdCatId}`,
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        }
      });
      assert.strictEqual(res.statusCode, 200);

      // Admin listing should no longer have it
      const adminList = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/categories',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        }
      });
      const body = JSON.parse(adminList.payload);
      const found = body.categories.find((c: any) => c.id === createdCatId);
      assert.strictEqual(found, undefined);
    });
  });
});
