/**
 * AweerMarket Order Details Access Control & Authorization Integration Test Suite
 * Tests strict Role-Based Access Control (RBAC), multi-tenant isolation, IDOR/BOLA defense,
 * buyer PII privacy, and accurate financial totals.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { UserRole, WholesaleUnit, DeliveryType, OrderStatus } from '@aweermarket/types';
import { buildServer } from './server.js';
import { createShop, resetInMemoryShops } from './models/shop.model.js';
import { createProduct, resetInMemoryProducts } from './models/product.model.js';
import { resetInMemoryOrders, createOrderRecord, findOrderById } from './models/order.model.js';
import {
  createSuperAdminUser,
  createBuyerUser,
  upsertResellerUser,
  createShopAdminUser,
  resetInMemoryUsers
} from './models/user.model.js';
import { createReseller, resetInMemoryResellers, setInMemoryResellerStoreAllowed } from './models/reseller.model.js';
import { signSessionToken, hashPassword } from './utils/crypto.js';
import { getSecretForRole } from './plugins/security.js';

describe('AweerMarket — Order Details Access Control & Authorization Suite', () => {
  let server: FastifyInstance;
  let superAdminToken: string;
  let resellerAToken: string;
  let resellerBToken: string;
  let buyerToken: string;
  let vendorToken: string;

  let resellerAId: string;
  let resellerBId: string;
  let shopAId: string;
  let shopBId: string;
  let buyerId: string;
  let orderAId: string;
  let orderBId: string;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    setInMemoryResellerStoreAllowed(true);
    resetInMemoryUsers();
    resetInMemoryShops();
    resetInMemoryProducts();
    resetInMemoryOrders();
    resetInMemoryResellers();

    server = await buildServer();
    await server.ready();

    // 1. Provision Super Admin
    const superAdmin = await createSuperAdminUser({
      email: 'admin@aweermarket.ae',
      passwordHash: await hashPassword('AdminPass123!'),
      fullName: 'Chief Super Admin'
    });
    superAdminToken = signSessionToken(
      { userId: superAdmin.id, role: UserRole.SUPER_ADMIN, email: superAdmin.email },
      getSecretForRole(UserRole.SUPER_ADMIN)
    );

    // 2. Provision Reseller A
    const resADoc = await createReseller({
      businessName: 'Reseller Alpha Trading LLC',
      contactPerson: 'Alpha Manager',
      email: 'alpha@reseller.ae',
      phone: '+971501112233',
      tradeLicenseNumber: 'TR-ALPHA-12345',
      status: 'approved',
      tier: 'gold',
      discountPercent: 10,
      paymentTerms: 'net_30',
      creditLimitAed: 50000,
      notes: 'Initial test reseller'
    });
    resellerAId = resADoc.id;
    const resAUser = await upsertResellerUser({
      resellerId: resellerAId,
      email: 'alpha@reseller.ae',
      passwordHash: await hashPassword('AlphaPass123!'),
      fullName: 'Alpha Manager'
    });
    resellerAToken = signSessionToken(
      { userId: resAUser.id, role: UserRole.RESELLER, email: resAUser.email, resellerId: resellerAId },
      getSecretForRole(UserRole.RESELLER)
    );

    // 3. Provision Reseller B
    const resBDoc = await createReseller({
      businessName: 'Reseller Beta Trading LLC',
      contactPerson: 'Beta Manager',
      email: 'beta@reseller.ae',
      phone: '+971504445566',
      tradeLicenseNumber: 'TR-BETA-67890',
      status: 'approved',
      tier: 'gold',
      discountPercent: 10,
      paymentTerms: 'net_30',
      creditLimitAed: 50000,
      notes: 'Second test reseller'
    });
    resellerBId = resBDoc.id;
    const resBUser = await upsertResellerUser({
      resellerId: resellerBId,
      email: 'beta@reseller.ae',
      passwordHash: await hashPassword('BetaPass123!'),
      fullName: 'Beta Manager'
    });
    resellerBToken = signSessionToken(
      { userId: resBUser.id, role: UserRole.RESELLER, email: resBUser.email, resellerId: resellerBId },
      getSecretForRole(UserRole.RESELLER)
    );

    // 4. Provision Buyer
    const buyer = await createBuyerUser({
      email: 'mohammed.buyer@dubai.ae',
      passwordHash: await hashPassword('BuyerPass123!'),
      fullName: 'Mohammed Al Falasi',
      phone: '+971559876543'
    });
    buyerId = buyer.id;
    buyerToken = signSessionToken(
      { userId: buyer.id, role: UserRole.BUYER, email: buyer.email },
      getSecretForRole(UserRole.BUYER)
    );

    // 5. Provision Shop Admin / Vendor
    const shopAdmin = await createShopAdminUser({
      shopId: 'shop_stall_default',
      email: 'vendor@stall.ae',
      passwordHash: await hashPassword('VendorPass123!'),
      fullName: 'Stall Vendor'
    });
    vendorToken = signSessionToken(
      { userId: shopAdmin.id, role: UserRole.SHOP_ADMIN, email: shopAdmin.email },
      getSecretForRole(UserRole.SHOP_ADMIN)
    );

    // 6. Provision Stall for Reseller A and Stall for Reseller B
    const shopA = await createShop({
      name: 'Alpha Fresh Produce Stall',
      slug: 'alpha-fresh-produce',
      stallNumber: 'STALL-A10',
      ownerId: 'owner_stall_001',
      phone: '+971501111111',
      tradeLicenseNumber: 'TL-ALPHA-001',
      resellerId: resellerAId
    });
    shopAId = shopA.id;

    const shopB = await createShop({
      name: 'Beta Citrus World Stall',
      slug: 'beta-citrus-world',
      stallNumber: 'STALL-B20',
      ownerId: 'owner_stall_002',
      phone: '+971502222222',
      tradeLicenseNumber: 'TL-BETA-002',
      resellerId: resellerBId
    });
    shopBId = shopB.id;

    // 7. Seed Order for Stall A (belongs to Reseller A)
    const orderA = await createOrderRecord({
      buyerId,
      shopId: shopAId,
      shopName: shopA.name,
      stallNumber: shopA.stallNumber,
      deliveryType: DeliveryType.SCHEDULED_DELIVERY,
      deliveryAddress: 'Villa 14, Al Khawaneej 1, Dubai, UAE',
      items: [
        {
          productId: 'prod_mango_01',
          name: 'Sindhri Mangoes Commercial',
          unit: WholesaleUnit.BOX,
          unitWeightKg: 5,
          quantity: 10,
          unitPriceAed: 45
        },
        {
          productId: 'prod_orange_01',
          name: 'Valencia Juice Oranges',
          unit: WholesaleUnit.CTN,
          unitWeightKg: 15,
          quantity: 4,
          unitPriceAed: 60
        }
      ]
    });
    orderAId = orderA.id;

    // 8. Seed Order for Stall B (belongs to Reseller B)
    const orderB = await createOrderRecord({
      buyerId,
      shopId: shopBId,
      shopName: shopB.name,
      stallNumber: shopB.stallNumber,
      deliveryType: DeliveryType.SHOP_PICKUP,
      pickupTime: '06:00 AM - 08:00 AM',
      items: [
        {
          productId: 'prod_apple_01',
          name: 'Royal Gala Apples Grade A',
          unit: WholesaleUnit.BOX,
          unitWeightKg: 18,
          quantity: 5,
          unitPriceAed: 85
        }
      ]
    });
    orderBId = orderB.id;
  });

  afterEach(async () => {
    setInMemoryResellerStoreAllowed(false);
    process.env.NODE_ENV = 'test';
    await server.close();
  });

  // Scenario 1: Super Admin can list all orders across the marketplace
  it('1. Super Admin can list all orders and view buyer contact info across marketplace', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/orders',
      headers: { authorization: `Bearer ${superAdminToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.orders.length, 2);

    const orderAlpha = body.orders.find((o: any) => o.id === orderAId);
    assert.ok(orderAlpha);
    assert.strictEqual(orderAlpha.buyerName, 'Mohammed Al Falasi');
    assert.strictEqual(orderAlpha.buyerPhone, '+971559876543');
    assert.strictEqual(orderAlpha.buyerEmail, 'mohammed.buyer@dubai.ae');
    assert.strictEqual(orderAlpha.totalAmountAed, 690);
    assert.strictEqual(orderAlpha.items[0].unit, WholesaleUnit.BOX);
    assert.strictEqual(orderAlpha.items[0].quantity, 10);
  });

  // Scenario 2: Super Admin can inspect complete details of any order
  it('2. Super Admin can view full details of any order by ID', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/admin/orders/${orderAId}`,
      headers: { authorization: `Bearer ${superAdminToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.order.id, orderAId);
    assert.strictEqual(body.order.buyerName, 'Mohammed Al Falasi');
    assert.strictEqual(body.order.buyerPhone, '+971559876543');
    assert.strictEqual(body.order.deliveryAddress, 'Villa 14, Al Khawaneej 1, Dubai, UAE');
    assert.strictEqual(body.order.paymentMethod, 'Cash on Delivery (COD)');
    assert.strictEqual(body.order.items.length, 2);
  });

  // Scenario 3: Reseller can list only orders belonging to their own shops
  it('3. Reseller A can list only orders belonging to their own affiliated shops', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/orders',
      headers: { authorization: `Bearer ${resellerAToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.orders.length, 1);
    assert.strictEqual(body.orders[0].id, orderAId);
    assert.strictEqual(body.orders[0].shopId, shopAId);
    assert.strictEqual(body.orders[0].buyerName, 'Mohammed Al Falasi');
  });

  // Scenario 4: Reseller can inspect details of their own order
  it('4. Reseller A can view complete details of their own order', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/admin/orders/${orderAId}`,
      headers: { authorization: `Bearer ${resellerAToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.order.id, orderAId);
    assert.strictEqual(body.order.buyerPhone, '+971559876543');
    assert.strictEqual(body.order.items[0].unit, WholesaleUnit.BOX);
  });

  // Scenario 5: Reseller CANNOT access another reseller's order by ID (IDOR / BOLA defense)
  it('5. Reseller A is blocked with 403 Forbidden when attempting to view Reseller B order', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/admin/orders/${orderBId}`,
      headers: { authorization: `Bearer ${resellerAToken}` }
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.error, 'Forbidden');
    assert.match(body.message, /Access denied/i);
  });

  // Scenario 6: Unauthorized roles (Buyer, Shop Admin) cannot access protected admin order details
  it('6. Buyer and Shop Admin receive 403 Forbidden when calling GET /admin/orders/:id', async () => {
    const resBuyer = await server.inject({
      method: 'GET',
      url: `/api/v1/admin/orders/${orderAId}`,
      headers: { authorization: `Bearer ${buyerToken}` }
    });
    assert.strictEqual(resBuyer.statusCode, 403);

    const resVendor = await server.inject({
      method: 'GET',
      url: `/api/v1/admin/orders/${orderAId}`,
      headers: { authorization: `Bearer ${vendorToken}` }
    });
    assert.strictEqual(resVendor.statusCode, 403);
  });

  // Scenario 7: Unauthenticated requests are rejected with 401 Unauthorized
  it('7. Unauthenticated request to /admin/orders/:id is rejected with 401 Unauthorized', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/admin/orders/${orderAId}`
    });
    assert.strictEqual(res.statusCode, 401);
  });

  // Scenario 8: Search and filtering respect role and ownership restrictions
  it('8. Reseller search filter matches within own orders only and cannot discover other orders', async () => {
    // Reseller A searches by buyer phone
    const resA = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/orders?search=971559876543',
      headers: { authorization: `Bearer ${resellerAToken}` }
    });
    assert.strictEqual(resA.statusCode, 200);
    const bodyA = JSON.parse(resA.body);
    assert.strictEqual(bodyA.orders.length, 1);
    assert.strictEqual(bodyA.orders[0].id, orderAId);

    // Reseller A searches for Order B's order number
    const orderBObj = await findOrderById(orderBId);
    const resASearchB = await server.inject({
      method: 'GET',
      url: `/api/v1/admin/orders?search=${orderBObj?.orderNumber}`,
      headers: { authorization: `Bearer ${resellerAToken}` }
    });
    assert.strictEqual(resASearchB.statusCode, 200);
    const bodyASearchB = JSON.parse(resASearchB.body);
    // Must NOT find Order B because Reseller A is tenant-scoped
    assert.strictEqual(bodyASearchB.orders.length, 0);
  });

  // Scenario 9: Stored order totals, selling units, and line subtotals match exact data
  it('9. Stored order data displays exact quantities, selling units, and financial totals', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/admin/orders/${orderAId}`,
      headers: { authorization: `Bearer ${superAdminToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const { order } = JSON.parse(res.body);

    assert.strictEqual(order.totalAmountAed, 690);
    assert.strictEqual(order.items[0].name, 'Sindhri Mangoes Commercial');
    assert.strictEqual(order.items[0].unit, WholesaleUnit.BOX);
    assert.strictEqual(order.items[0].quantity, 10);
    assert.strictEqual(order.items[0].unitPriceAed, 45);
    assert.strictEqual(order.items[0].lineTotalAed, 450);

    assert.strictEqual(order.items[1].name, 'Valencia Juice Oranges');
    assert.strictEqual(order.items[1].unit, WholesaleUnit.CTN);
    assert.strictEqual(order.items[1].quantity, 4);
    assert.strictEqual(order.items[1].unitPriceAed, 60);
    assert.strictEqual(order.items[1].lineTotalAed, 240);

    assert.strictEqual(order.subtotalAed, Math.round((690 / 1.05) * 100) / 100);
    assert.strictEqual(order.vatAed, Math.round((690 - order.subtotalAed) * 100) / 100);
  });

  // Scenario 10: Non-existent order returns 404
  it('10. Non-existent order returns 404 Not Found', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/orders/ord_non_existent_999',
      headers: { authorization: `Bearer ${superAdminToken}` }
    });

    assert.strictEqual(res.statusCode, 404);
  });
});
