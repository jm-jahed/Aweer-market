/**
 * AweerMarket Buyer Order Creation & Checkout Integration Tests
 * Uses native Node.js test runner (node --test) with Fastify inject.
 * Verifies server price authority, atomic stock reservation, MOQ enforcement,
 * and buyer order retrieval isolation.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { UserRole, WholesaleUnit, ProductCategory, DeliveryType } from '@aweermarket/types';
import { buildServer } from './server.js';
import { createShop, resetInMemoryShops } from './models/shop.model.js';
import { createProduct, resetInMemoryProducts, findProductById } from './models/product.model.js';
import { resetInMemoryOrders, findOrdersByBuyerId } from './models/order.model.js';
import { createShopAdminUser, createBuyerUser, findUserById, resetInMemoryUsers, setUserActiveStatus } from './models/user.model.js';
import { signSessionToken } from './utils/crypto.js';
import { getSecretForRole } from './plugins/security.js';

describe('AweerMarket Step 7 — Buyer Cart & Single-Vendor Wholesale Checkout', () => {
  let server: FastifyInstance;
  let buyerToken: string;
  let buyer2Token: string;
  let vendorAToken: string;
  let vendorBToken: string;
  let vendorUnlinkedToken: string;
  let superAdminToken: string;
  let vendorAUserId: string;
  let vendorBUserId: string;
  let shop: any;
  let shopB: any;
  let buyerId: string;
  let buyer2Id: string;
  let shopAId: string;
  let shopBId: string;
  let prodOrangeId: string;
  let prodBananaId: string;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    resetInMemoryUsers();
    resetInMemoryShops();
    resetInMemoryProducts();
    resetInMemoryOrders();

    const buyer1User = await createBuyerUser({
      email: 'buyer1@test.com',
      passwordHash: 'dummy_hash',
      fullName: 'Buyer One'
    });
    buyerId = buyer1User.id;
    buyerToken = signSessionToken({ userId: buyerId, role: UserRole.BUYER, email: 'buyer1@test.com' }, getSecretForRole(UserRole.BUYER));

    const buyer2User = await createBuyerUser({
      email: 'buyer2@test.com',
      passwordHash: 'dummy_hash',
      fullName: 'Buyer Two'
    });
    buyer2Id = buyer2User.id;
    buyer2Token = signSessionToken({ userId: buyer2Id, role: UserRole.BUYER, email: 'buyer2@test.com' }, getSecretForRole(UserRole.BUYER));

    server = await buildServer();
    await server.ready();

    // Seed approved wholesale stall A
    shop = await createShop({
      name: 'Al Aweer Premium Produce LLC',
      stallNumber: 'Block A, Stall 15',
      ownerId: 'pending',
      tradeLicenseNumber: 'TL-554433',
      phone: '+971505556677',
      isApproved: true,
      isActive: true
    });
    shopAId = shop.id;

    // Seed Vendor A User in authoritative user store
    const vendorAUser = await createShopAdminUser({
      email: 'vendor1@test.com',
      passwordHash: 'dummy_hash',
      fullName: 'Vendor A Manager',
      shopId: shopAId,
      phone: '+971505556677'
    });
    vendorAUserId = vendorAUser.id;
    shop.ownerId = vendorAUserId;

    // Seed approved wholesale stall B (for cross-tenant IDOR verification)
    shopB = await createShop({
      name: 'Dubai Fresh Green Stalls LLC',
      stallNumber: 'Block B, Stall 22',
      ownerId: 'pending',
      tradeLicenseNumber: 'TL-889900',
      phone: '+971508889900',
      isApproved: true,
      isActive: true
    });
    shopBId = shopB.id;

    // Seed Vendor B User in authoritative user store
    const vendorBUser = await createShopAdminUser({
      email: 'vendor2@test.com',
      passwordHash: 'dummy_hash',
      fullName: 'Vendor B Manager',
      shopId: shopBId,
      phone: '+971508889900'
    });
    vendorBUserId = vendorBUser.id;
    shopB.ownerId = vendorBUserId;

    vendorAToken = signSessionToken(
      { userId: vendorAUserId, role: UserRole.SHOP_ADMIN, email: 'vendor1@test.com', shopId: shopAId },
      getSecretForRole(UserRole.SHOP_ADMIN)
    );
    vendorBToken = signSessionToken(
      { userId: vendorBUserId, role: UserRole.SHOP_ADMIN, email: 'vendor2@test.com', shopId: shopBId },
      getSecretForRole(UserRole.SHOP_ADMIN)
    );
    vendorUnlinkedToken = signSessionToken(
      { userId: 'owner_unlinked', role: UserRole.SHOP_ADMIN, email: 'unlinked@test.com' },
      getSecretForRole(UserRole.SHOP_ADMIN)
    );
    superAdminToken = signSessionToken(
      { userId: 'usr_super_admin', role: UserRole.SUPER_ADMIN, email: 'admin@aweermarket.ae' },
      getSecretForRole(UserRole.SUPER_ADMIN)
    );

    // Seed product 1: Valencia Oranges (15kg carton, 45 AED, MOQ 5, Stock 50)
    const orange = await createProduct({
      name: 'Valencia Oranges',
      category: ProductCategory.CITRUS,
      originCountry: 'Egypt',
      offers: [
        {
          shopId: shopAId,
          shopName: 'Al Aweer Premium Produce LLC',
          stallNumber: 'Block A, Stall 15',
          unit: WholesaleUnit.CARTON,
          unitWeightKg: 15,
          priceAed: 45, // 3.00 AED/kg
          minOrderQuantity: 5,
          availableStock: 50
        }
      ]
    });
    prodOrangeId = orange.id;

    // Seed product 2: Cavendish Bananas (13kg box, 65 AED, MOQ 2, Stock 20)
    const banana = await createProduct({
      name: 'Cavendish Bananas',
      category: ProductCategory.FRESH_FRUITS,
      originCountry: 'Ecuador',
      offers: [
        {
          shopId: shopAId,
          shopName: 'Al Aweer Premium Produce LLC',
          stallNumber: 'Block A, Stall 15',
          unit: WholesaleUnit.BOX,
          unitWeightKg: 13,
          priceAed: 65, // 5.00 AED/kg
          minOrderQuantity: 2,
          availableStock: 20
        }
      ]
    });
    prodBananaId = banana.id;
  });

  afterEach(async () => {
    await server.close();
  });

  describe('1. Authentication & Tenant Authorization', () => {
    it('rejects unauthenticated order creation with 401 Unauthorized', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });

      assert.strictEqual(res.statusCode, 401);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /authentication.*required/i);
    });

    it('rejects order for non-existent or unapproved shop with 400 Bad Request', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: 'shop_non_existent',
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /does not exist or is not approved/i);
    });

    it('rejects order creation by non-buyer roles (Shop Admin) with 403 Forbidden', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${vendorAToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });

      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /only registered buyers can place wholesale orders/i);
    });

    it('rejects order creation by Super Admin with 403 Forbidden', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });

      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /only registered buyers can place wholesale orders/i);
    });
  });

  describe('2. Server Price Authority & Line Item Calculation', () => {
    it('calculates order line totals and overall total strictly from server catalog offers', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SCHEDULED_DELIVERY,
          deliveryAddress: 'Deira Wholesale Market, Dubai',
          items: [
            { productId: prodOrangeId, quantity: 6 }, // 6 * 45 = 270 AED
            { productId: prodBananaId, quantity: 3 }  // 3 * 65 = 195 AED
          ]
        }
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.statusCode, 201);
      assert.ok(body.order.orderNumber);
      assert.strictEqual(body.order.buyerId, buyerId);
      assert.strictEqual(body.order.shopId, shopAId);
      assert.strictEqual(body.order.items.length, 2);

      // Verify item 1
      assert.strictEqual(body.order.items[0].name, 'Valencia Oranges');
      assert.strictEqual(body.order.items[0].quantity, 6);
      assert.strictEqual(body.order.items[0].unitPriceAed, 45);
      assert.strictEqual(body.order.items[0].lineTotalAed, 270);

      // Verify item 2
      assert.strictEqual(body.order.items[1].name, 'Cavendish Bananas');
      assert.strictEqual(body.order.items[1].quantity, 3);
      assert.strictEqual(body.order.items[1].unitPriceAed, 65);
      assert.strictEqual(body.order.items[1].lineTotalAed, 195);

      // Verify total: 270 + 195 = 465 AED
      assert.strictEqual(body.order.totalAmountAed, 465);
      assert.strictEqual(body.order.status, 'pending');
    });
  });

  describe('3. MOQ & Inventory Consistency (Atomic Reservation)', () => {
    it('enforces Minimum Order Quantity (MOQ) and rejects lower quantities with 400 Bad Request', async () => {
      // MOQ for Oranges is 5, buyer tries to order 3
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 3 }]
        }
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /Minimum order quantity/i);
    });

    it('atomically decrements stock upon successful order placement', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 10 }]
        }
      });

      assert.strictEqual(res.statusCode, 201);

      // Check persisted produce offer stock (50 - 10 = 40)
      const updatedOrange = await findProductById(prodOrangeId);
      assert.ok(updatedOrange);
      const offer = updatedOrange.offers.find((o) => o.shopId === shopAId);
      assert.strictEqual(offer?.availableStock, 40);
    });

    it('rejects order with 400 Bad Request when requested quantity exceeds available stock', async () => {
      // Stock is 50, buyer orders 99
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 99 }]
        }
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /Insufficient stock/i);

      // Stock must remain unchanged at 50
      const orange = await findProductById(prodOrangeId);
      const offer = orange?.offers.find((o) => o.shopId === shopAId);
      assert.strictEqual(offer?.availableStock, 50);
    });
  });

  describe('4. Buyer Order History & Privacy Isolation', () => {
    it('allows buyer to view their own order list', async () => {
      // Place order for buyer 1
      await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });

      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.orders.length, 1);
      assert.strictEqual(body.orders[0].buyerId, buyerId);
    });

    it('PREVENTS Buyer B from viewing Buyer A order details (403 Forbidden)', async () => {
      // Place order for Buyer 1
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });
      const orderId = JSON.parse(createRes.payload).order.id;

      // Buyer 2 attempts to fetch Buyer 1's order
      const getRes = await server.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
        headers: {
          Cookie: `aweer_session=${buyer2Token}`
        }
      });

      assert.strictEqual(getRes.statusCode, 403);
      const body = JSON.parse(getRes.payload);
      assert.match(body.message, /Access denied/i);
    });

    it('PREVENTS Shop Admin B from viewing Shop A customer order details (403 Forbidden - IDOR fix)', async () => {
      // Place order for Buyer 1 at Shop A
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });
      const orderId = JSON.parse(createRes.payload).order.id;

      // Vendor B (Shop Admin of Shop B) attempts to inspect Shop A's order
      const getRes = await server.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
        headers: {
          Cookie: `aweer_session=${vendorBToken}`
        }
      });

      assert.strictEqual(getRes.statusCode, 403);
      const body = JSON.parse(getRes.payload);
      assert.match(body.message, /Access denied/i);
    });

    it('ALLOWS Shop Admin A to view order details fulfilling their own stall (200 OK)', async () => {
      // Place order for Buyer 1 at Shop A
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });
      const orderId = JSON.parse(createRes.payload).order.id;

      // Vendor A (Shop Admin of Shop A) fetches the order
      const getRes = await server.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
        headers: {
          Cookie: `aweer_session=${vendorAToken}`
        }
      });

      assert.strictEqual(getRes.statusCode, 200);
      const body = JSON.parse(getRes.payload);
      assert.strictEqual(body.order.id, orderId);
      assert.strictEqual(body.order.shopId, shopAId);
    });

    it('FAILS CLOSED if vendor has no associated shop or stale stall association (403 Forbidden)', async () => {
      // Place order for Buyer 1 at Shop A
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });
      const orderId = JSON.parse(createRes.payload).order.id;

      // Unlinked vendor attempts to access the order
      const getRes = await server.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
        headers: {
          Cookie: `aweer_session=${vendorUnlinkedToken}`
        }
      });

      assert.strictEqual(getRes.statusCode, 403);
      const body = JSON.parse(getRes.payload);
      assert.match(body.message, /Access denied/i);
    });

    it('DENIES access when token is stale after shop ownership is revoked in database (403 Forbidden)', async () => {
      // Place order for Buyer 1 at Shop A
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });
      const orderId = JSON.parse(createRes.payload).order.id;

      // Ownership revoked in DB: Shop A ownerId changed to another user
      shop.ownerId = 'reassigned_owner_xyz';

      // Vendor A attempts to use their active session token to access Shop A's order
      const getRes = await server.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
        headers: {
          Cookie: `aweer_session=${vendorAToken}`
        }
      });

      assert.strictEqual(getRes.statusCode, 403);
      const body = JSON.parse(getRes.payload);
      assert.match(body.message, /Access denied/i);
    });

    it('DENIES access to Shop A when vendor was reassigned to Shop B in database (403 Forbidden)', async () => {
      // Place order for Buyer 1 at Shop A
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });
      const orderId = JSON.parse(createRes.payload).order.id;

      // Vendor A reassigned in DB to Shop B
      shop.ownerId = 'new_owner_of_shop_a';
      shopB.ownerId = vendorAUserId;

      // Vendor A attempts to use their old token (claiming shopAId) to fetch Shop A's order
      const getRes = await server.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
        headers: {
          Cookie: `aweer_session=${vendorAToken}`
        }
      });

      assert.strictEqual(getRes.statusCode, 403);
      const body = JSON.parse(getRes.payload);
      assert.match(body.message, /Access denied/i);
    });

    it('DENIES access when shop is suspended or inactive in database (403 Forbidden)', async () => {
      // Place order for Buyer 1 at Shop A
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });
      const orderId = JSON.parse(createRes.payload).order.id;

      // Shop A is suspended by Super Admin (isActive: false)
      shop.isActive = false;

      const getRes = await server.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
        headers: {
          Cookie: `aweer_session=${vendorAToken}`
        }
      });

      assert.strictEqual(getRes.statusCode, 403);
      const body = JSON.parse(getRes.payload);
      assert.match(body.message, /Access denied/i);
    });

    it('DENIES access when vendor user is deactivated in database (403 Forbidden)', async () => {
      // Place order for Buyer 1 at Shop A
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });
      const orderId = JSON.parse(createRes.payload).order.id;

      // Vendor A user account is suspended by Super Admin
      await setUserActiveStatus(vendorAUserId, false);

      const getRes = await server.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
        headers: {
          Cookie: `aweer_session=${vendorAToken}`
        }
      });

      assert.strictEqual(getRes.statusCode, 403);
      const body = JSON.parse(getRes.payload);
      assert.match(body.message, /Access denied/i);
    });

    it('DENIES access when vendor user does not exist in database (403 Forbidden)', async () => {
      // Place order for Buyer 1 at Shop A
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });
      const orderId = JSON.parse(createRes.payload).order.id;

      // Token minted for non-existent ghost user
      const ghostVendorToken = signSessionToken(
        { userId: 'ghost_vendor_user_999', role: UserRole.SHOP_ADMIN, email: 'ghost@test.com', shopId: shopAId },
        getSecretForRole(UserRole.SHOP_ADMIN)
      );

      const getRes = await server.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
        headers: {
          Cookie: `aweer_session=${ghostVendorToken}`
        }
      });

      assert.strictEqual(getRes.statusCode, 403);
      const body = JSON.parse(getRes.payload);
      assert.match(body.message, /Access denied/i);
    });

    it('ALLOWS Super Admin to view order details under platform audit oversight (200 OK)', async () => {
      // Place order for Buyer 1 at Shop A
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });
      const orderId = JSON.parse(createRes.payload).order.id;

      // Super Admin fetches the order
      const getRes = await server.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderId}`,
        headers: {
          Cookie: `aweer_session=${superAdminToken}`
        }
      });

      assert.strictEqual(getRes.statusCode, 200);
      const body = JSON.parse(getRes.payload);
      assert.strictEqual(body.order.id, orderId);
    });
  });

  // ==========================================================================
  // 6. Buyer Live Account Status Verification (Phase 3.3)
  // ==========================================================================
  describe('6. Buyer Live Account Status Verification', () => {
    it('ALLOWS active database buyer with a valid token to create an order (201 Created)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.statusCode, 201);
      assert.ok(body.order);
      assert.strictEqual(body.order.buyerId, buyerId);
    });

    it('DENIES inactive buyer with an otherwise valid JWT (403 Forbidden)', async () => {
      // Record initial offer stock
      const prodBefore = await findProductById(prodOrangeId);
      const stockBefore = prodBefore!.offers.find((o) => o.shopId === shopAId)!.availableStock;

      // Suspend / deactivate buyer in database
      const updated = await setUserActiveStatus(buyerId, false);
      assert.strictEqual(updated, true);

      // Attempt to create an order using previously issued token
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });

      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.statusCode, 403);
      assert.strictEqual(body.error, 'Forbidden');
      assert.match(body.message, /deactivated/i);

      // Verify NO stock reservation side effect occurred
      const prodAfter = await findProductById(prodOrangeId);
      const stockAfter = prodAfter!.offers.find((o) => o.shopId === shopAId)!.availableStock;
      assert.strictEqual(stockAfter, stockBefore, 'Produce stock must not be reserved when buyer is deactivated');

      // Also verify GET /orders fails for deactivated buyer
      const historyRes = await server.inject({
        method: 'GET',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        }
      });
      assert.strictEqual(historyRes.statusCode, 403);
    });

    it('DENIES missing or deleted buyer record with a valid JWT (401 Unauthorized)', async () => {
      // Record initial offer stock
      const prodBefore = await findProductById(prodOrangeId);
      const stockBefore = prodBefore!.offers.find((o) => o.shopId === shopAId)!.availableStock;

      // Token minted with non-existent / deleted buyer user ID
      const ghostBuyerToken = signSessionToken(
        { userId: 'ghost_buyer_999_deleted', role: UserRole.BUYER, email: 'ghost_buyer@test.com' },
        getSecretForRole(UserRole.BUYER)
      );

      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${ghostBuyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });

      assert.strictEqual(res.statusCode, 401);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.statusCode, 401);
      assert.strictEqual(body.error, 'Unauthorized');
      assert.match(body.message, /not found/i);

      // Verify NO stock was reserved
      const prodAfter = await findProductById(prodOrangeId);
      const stockAfter = prodAfter!.offers.find((o) => o.shopId === shopAId)!.availableStock;
      assert.strictEqual(stockAfter, stockBefore, 'Produce stock must not be reserved for non-existent buyer');

      // Also verify GET /orders fails with 401
      const historyRes = await server.inject({
        method: 'GET',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${ghostBuyerToken}`
        }
      });
      assert.strictEqual(historyRes.statusCode, 401);
    });

    it('DENIES user whose database role changed from BUYER (403 Forbidden)', async () => {
      // Demote / change user role in database to SHOP_ADMIN
      const buyerUser = await findUserById(buyerId);
      assert.ok(buyerUser);
      (buyerUser as any).role = UserRole.SHOP_ADMIN;

      // Attempt to create order using original BUYER token
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        },
        payload: {
          shopId: shopAId,
          deliveryType: DeliveryType.SHOP_PICKUP,
          items: [{ productId: prodOrangeId, quantity: 5 }]
        }
      });

      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.statusCode, 403);
      assert.strictEqual(body.error, 'Forbidden');
      assert.match(body.message, /Only registered buyers can place wholesale orders/i);

      // Verify GET /orders fails with 403
      const historyRes = await server.inject({
        method: 'GET',
        url: '/api/v1/orders',
        headers: {
          Cookie: `aweer_session=${buyerToken}`
        }
      });
      assert.strictEqual(historyRes.statusCode, 403);
    });
  });
});
