/**
 * AweerMarket Super Admin Portal Unit & Contract Tests
 * Uses native Node.js test runner (node --test) without external dependencies.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  superAdminLogin,
  getSuperAdminMe,
  superAdminLogout,
  getAdminOverview,
  getAdminShops,
  setAdminShopApproval,
  getAdminUsers,
  setAdminUserStatus,
  getAdminProducts,
  setAdminProductModeration,
  getAdminOrders,
  setAdminShopStatus,
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  setAdminCategoryStatus,
  deleteAdminCategory,
  ApiClientError
} from '../src/lib/api-client.ts';

describe('Step 3: Super Admin Portal API Client Tests', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockSuperAdmin = {
    id: 'usr_super_admin_001',
    email: 'root@aweermarket.ae',
    fullName: 'Platform Super Admin',
    role: 'super_admin',
    isActive: true,
    isEmailVerified: true,
    createdAt: '2026-10-22T00:00:00.000Z'
  };

  // 1. Super Admin Authentication
  describe('Super Admin Auth', () => {
    it('authenticates super admin with valid credentials (HTTP 200)', async () => {
      let capturedUrl = '';
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return new Response(JSON.stringify({ statusCode: 200, user: mockSuperAdmin }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const result = await superAdminLogin('root@aweermarket.ae', 'SuperSecretMaster#2026');

      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.user.email, 'root@aweermarket.ae');
      assert.strictEqual(result.user.role, 'super_admin');
      assert.ok(capturedUrl.endsWith('/auth/super-admin/login'));
      assert.strictEqual(capturedOptions.method, 'POST');
      assert.strictEqual(capturedOptions.credentials, 'include');

      const body = JSON.parse(capturedOptions.body);
      assert.strictEqual(body.email, 'root@aweermarket.ae');
    });

    it('rejects unprivileged accounts with HTTP 403 Forbidden', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ statusCode: 403, error: 'Forbidden', message: 'Super admin privileged access required' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await superAdminLogin('buyer@example.com', 'BuyerPass123!');
        },
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.message, 'Super admin privileged access required');
          return true;
        }
      );
    });

    it('retrieves active super admin session from /auth/super-admin/me', async () => {
      globalThis.fetch = async (url) => {
        assert.ok(url.endsWith('/auth/super-admin/me'));
        return new Response(JSON.stringify({ statusCode: 200, user: mockSuperAdmin }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const res = await getSuperAdminMe();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.user.role, 'super_admin');
    });

    it('logs out and clears cookies via /auth/logout', async () => {
      let capturedMethod = '';
      globalThis.fetch = async (url, options) => {
        capturedMethod = options.method;
        assert.ok(url.endsWith('/auth/logout'));
        return new Response(JSON.stringify({ statusCode: 200, message: 'Logged out successfully' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const res = await superAdminLogout();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(capturedMethod, 'POST');
    });
  });

  // 2. Platform Overview & Metrics
  describe('Platform Overview', () => {
    it('fetches real platform metrics from /admin/overview', async () => {
      const mockMetrics = {
        totalUsers: 15,
        buyers: 10,
        shopAdmins: 4,
        superAdmins: 1,
        totalShops: 4,
        approvedShops: 3,
        pendingShops: 1,
        totalProducts: 12,
        activeProducts: 10,
        inactiveProducts: 2,
        totalOrders: 42
      };

      globalThis.fetch = async (url) => {
        assert.ok(url.endsWith('/admin/overview'));
        return new Response(JSON.stringify({ statusCode: 200, metrics: mockMetrics }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const res = await getAdminOverview();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.metrics.totalUsers, 15);
      assert.strictEqual(res.metrics.approvedShops, 3);
      assert.strictEqual(res.metrics.totalOrders, 42);
    });
  });

  // 3. Stalls Governance
  describe('Stalls Governance', () => {
    it('fetches shops list with optional status filter', async () => {
      let capturedUrl = '';
      globalThis.fetch = async (url) => {
        capturedUrl = url;
        return new Response(
          JSON.stringify({
            statusCode: 200,
            shops: [
              {
                id: 'shop_001',
                name: 'Al Aweer Central Produce',
                slug: 'al-aweer-central',
                stallNumber: 'ST-01',
                phone: '+971500000001',
                isApproved: true,
                isActive: true,
                createdAt: '2026-10-22T00:00:00.000Z'
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getAdminShops('approved');
      assert.strictEqual(res.shops.length, 1);
      assert.strictEqual(res.shops[0].stallNumber, 'ST-01');
      assert.ok(capturedUrl.includes('?status=approved'));
    });

    it('updates stall approval via PATCH /admin/shops/:id/approval', async () => {
      let capturedMethod = '';
      let capturedBody = null;

      globalThis.fetch = async (url, options) => {
        capturedMethod = options.method;
        capturedBody = JSON.parse(options.body);
        assert.ok(url.endsWith('/admin/shops/shop_999/approval'));
        return new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Shop approval updated',
            shop: { id: 'shop_999', isApproved: true }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await setAdminShopApproval('shop_999', true);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(capturedMethod, 'PATCH');
      assert.strictEqual(capturedBody.isApproved, true);
      assert.strictEqual(res.shop.isApproved, true);
    });
  });

  // 4. User Governance
  describe('User Governance', () => {
    it('fetches platform users and updates active status', async () => {
      let capturedPatchUrl = '';
      let capturedBody = null;

      globalThis.fetch = async (url, options) => {
        if (!options || !options.method || options.method === 'GET') {
          return new Response(
            JSON.stringify({
              statusCode: 200,
              users: [mockSuperAdmin]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        capturedPatchUrl = url;
        capturedBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'User status updated',
            user: { ...mockSuperAdmin, isActive: false }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const listRes = await getAdminUsers();
      assert.strictEqual(listRes.users.length, 1);

      const patchRes = await setAdminUserStatus('usr_test_123', false);
      assert.ok(capturedPatchUrl.endsWith('/admin/users/usr_test_123/status'));
      assert.strictEqual(capturedBody.isActive, false);
      assert.strictEqual(patchRes.user.isActive, false);
    });
  });

  // 5. Produce Catalog Moderation
  describe('Produce Moderation', () => {
    it('moderates produce items via PATCH /admin/products/:id/moderation', async () => {
      let capturedUrl = '';
      let capturedBody = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Product delisted successfully',
            product: { id: 'prod_tomatoes_01', isActive: false }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await setAdminProductModeration('prod_tomatoes_01', false);
      assert.strictEqual(res.statusCode, 200);
      assert.ok(capturedUrl.endsWith('/admin/products/prod_tomatoes_01/moderation'));
      assert.strictEqual(capturedBody.isActive, false);
      assert.strictEqual(res.product.isActive, false);
    });
  });

  // 6. Wholesale Orders, Commissions & Stall Delisting (Step 9)
  describe('Wholesale Orders, Commissions & Stall Delisting', () => {
    it('fetches platform-wide orders with commission calculations via GET /admin/orders', async () => {
      let capturedUrl = '';
      globalThis.fetch = async (url) => {
        capturedUrl = url;
        return new Response(
          JSON.stringify({
            statusCode: 200,
            financials: {
              totalGmvAed: 1500,
              totalCommissionAed: 75,
              commissionRatePercent: 5,
              deliveredGmvAed: 1000,
              deliveredCommissionAed: 50,
              ordersByStatus: { delivered: 2, pending: 1 }
            },
            orders: [
              {
                id: 'ord_adm_001',
                orderNumber: 'AWEER-20261023-ADM1',
                buyerId: 'usr_buyer_1',
                shopId: 'shop_stall_42',
                shopName: 'Al Aweer Royal Dates LLC',
                stallNumber: 'ST-42',
                deliveryType: 'delivery',
                status: 'pending',
                totalAmountAed: 500,
                commissionAed: 25,
                commissionRatePercent: 5,
                items: [],
                createdAt: '2026-10-23T01:00:00.000Z',
                updatedAt: '2026-10-23T01:00:00.000Z'
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getAdminOrders('pending');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.orders.length, 1);
      assert.strictEqual(res.orders[0].totalAmountAed, 500);
      assert.strictEqual(res.orders[0].commissionAed, 25);
      assert.strictEqual(res.financials.totalCommissionAed, 75);
      assert.ok(capturedUrl.includes('/admin/orders?status=pending'));
    });

    it('toggles stall active status (delisting/reactivation) via PATCH /admin/shops/:id/status', async () => {
      let capturedUrl = '';
      let capturedBody = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Shop suspended and delisted from marketplace',
            shop: { id: 'shop_stall_42', isActive: false }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await setAdminShopStatus('shop_stall_42', false);
      assert.strictEqual(res.statusCode, 200);
      assert.ok(capturedUrl.endsWith('/admin/shops/shop_stall_42/status'));
      assert.strictEqual(capturedBody.isActive, false);
      assert.strictEqual(res.shop.isActive, false);
    });
  });

  // 7. Phase 1: Category Management
  describe('Phase 1: Category Management', () => {
    it('fetches categories list via GET /admin/categories', async () => {
      let capturedUrl = '';

      globalThis.fetch = async (url) => {
        capturedUrl = url;
        return new Response(
          JSON.stringify({
            statusCode: 200,
            categories: [
              {
                id: 'cat_001',
                name: 'Fresh Fruits',
                slug: 'fresh_fruits',
                icon: '🍎',
                isActive: true,
                sortOrder: 1,
                productCount: 4
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getAdminCategories();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.categories.length, 1);
      assert.strictEqual(res.categories[0].slug, 'fresh_fruits');
      assert.strictEqual(res.categories[0].productCount, 4);
      assert.ok(capturedUrl.endsWith('/admin/categories'));
    });

    it('creates category with validated input via POST /admin/categories', async () => {
      let capturedUrl = '';
      let capturedBody = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            statusCode: 201,
            message: 'Category created successfully',
            category: { id: 'cat_new', ...capturedBody, isActive: true }
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await createAdminCategory({
        name: 'Organic Dates',
        slug: 'organic_dates',
        icon: '🌴',
        description: 'Premium wholesale Emirati dates',
        sortOrder: 8
      });

      assert.strictEqual(res.statusCode, 201);
      assert.ok(capturedUrl.endsWith('/admin/categories'));
      assert.strictEqual(capturedBody.slug, 'organic_dates');
      assert.strictEqual(capturedBody.name, 'Organic Dates');
    });

    it('updates category properties via PUT /admin/categories/:id', async () => {
      let capturedUrl = '';
      let capturedBody = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Category updated successfully',
            category: { id: 'cat_001', ...capturedBody }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await updateAdminCategory('cat_001', {
        name: 'Fresh Fruits (Imported)',
        icon: '🍇'
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(capturedUrl.endsWith('/admin/categories/cat_001'));
      assert.strictEqual(capturedBody.name, 'Fresh Fruits (Imported)');
      assert.strictEqual(capturedBody.icon, '🍇');
    });

    it('toggles category active status via PATCH /admin/categories/:id/status', async () => {
      let capturedUrl = '';
      let capturedBody = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Category status updated',
            category: { id: 'cat_001', isActive: capturedBody.isActive }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await setAdminCategoryStatus('cat_001', false);
      assert.strictEqual(res.statusCode, 200);
      assert.ok(capturedUrl.endsWith('/admin/categories/cat_001/status'));
      assert.strictEqual(capturedBody.isActive, false);
      assert.strictEqual(res.category.isActive, false);
    });

    it('deletes or deactivates category via DELETE /admin/categories/:id', async () => {
      let capturedUrl = '';
      let capturedMethod = '';

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedMethod = options.method;
        return new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Category deactivated safely because 3 active products reference it',
            deactivated: true
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await deleteAdminCategory('cat_001');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(capturedMethod, 'DELETE');
      assert.ok(capturedUrl.endsWith('/admin/categories/cat_001'));
      assert.strictEqual(res.deactivated, true);
    });

    it('throws ApiClientError with 409 Conflict when duplicate slug is submitted', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 409,
            error: 'Conflict',
            message: 'Category with slug "fresh_fruits" already exists'
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await createAdminCategory({
            name: 'Fresh Fruits',
            slug: 'fresh_fruits'
          });
        },
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 409);
          assert.ok(err.message.includes('already exists'));
          return true;
        }
      );
    });
  });
});
