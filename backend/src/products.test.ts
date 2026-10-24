/**
 * AweerMarket Product Catalog, Shop, & Order Model Integration Tests
 * Uses native Node.js test runner (node --test) with Fastify inject.
 * Verifies public catalog browsing, category validation, AED/kg calculation,
 * server price authority on orders, and fail-closed database behavior.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { ProductCategory, WholesaleUnit, DeliveryType } from '@aweermarket/types';
import { buildServer } from './server.js';
import {
  createProduct,
  resetInMemoryProducts,
  calculateEquivalentPricePerKg,
  computeLowestPricePerKg,
  findProducts,
  findProductById
} from './models/product.model.js';
import { createShop, resetInMemoryShops } from './models/shop.model.js';
import { createOrderRecord, resetInMemoryOrders, findOrdersByBuyerId } from './models/order.model.js';

describe('AweerMarket Step 2 — Backend & Database Foundation', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    resetInMemoryProducts();
    resetInMemoryShops();
    resetInMemoryOrders();
    server = await buildServer();
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  // ==========================================================================
  // 1. Categories Endpoint
  // ==========================================================================
  describe('1. GET /api/v1/categories', () => {
    it('returns all supported wholesale produce categories with labels', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/categories'
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.statusCode, 200);
      assert.ok(Array.isArray(body.categories));
      assert.ok(body.categories.length >= 7);

      const keys = body.categories.map((c: { key: string }) => c.key);
      assert.ok(keys.includes(ProductCategory.FRESH_FRUITS));
      assert.ok(keys.includes(ProductCategory.FRESH_VEGETABLES));
      assert.ok(keys.includes(ProductCategory.CITRUS));
      assert.ok(keys.includes(ProductCategory.BERRIES));
      assert.ok(keys.includes(ProductCategory.LEAFY_GREENS));
      assert.ok(keys.includes(ProductCategory.ROOT_VEGETABLES));
      assert.ok(keys.includes(ProductCategory.EXOTIC_PRODUCE));
    });
  });

  // ==========================================================================
  // 2. Mathematical AED/kg Price Normalization
  // ==========================================================================
  describe('2. AED/kg Price Normalization', () => {
    it('correctly calculates equivalent price per kg rounded to 2 decimal places', () => {
      // 15kg carton for 48 AED = 3.20 AED/kg
      assert.strictEqual(calculateEquivalentPricePerKg(48, 15), 3.2);

      // 8kg crate for 25 AED = 3.125 -> 3.13 AED/kg
      assert.strictEqual(calculateEquivalentPricePerKg(25, 8), 3.13);

      // 1kg for 12.50 AED = 12.50 AED/kg
      assert.strictEqual(calculateEquivalentPricePerKg(12.5, 1), 12.5);
    });

    it('rejects non-positive unit weight with error', () => {
      assert.throws(() => calculateEquivalentPricePerKg(50, 0), /strictly positive/i);
      assert.throws(() => calculateEquivalentPricePerKg(50, -5), /strictly positive/i);
    });

    it('computes lowest price per kg accurately across active in-stock stall offers', () => {
      const offers = [
        {
          shopId: 'shop_1',
          shopName: 'Stall A-10',
          unit: WholesaleUnit.CARTON,
          unitWeightKg: 15,
          priceAed: 60, // 4.00 AED/kg
          equivalentPricePerKg: 4.0,
          minOrderQuantity: 1,
          availableStock: 50,
          isActive: true
        },
        {
          shopId: 'shop_2',
          shopName: 'Stall B-04',
          unit: WholesaleUnit.CARTON,
          unitWeightKg: 15,
          priceAed: 45, // 3.00 AED/kg
          equivalentPricePerKg: 3.0,
          minOrderQuantity: 5,
          availableStock: 80,
          isActive: true
        },
        {
          shopId: 'shop_3',
          shopName: 'Stall C-12',
          unit: WholesaleUnit.CARTON,
          unitWeightKg: 15,
          priceAed: 30, // 2.00 AED/kg (out of stock)
          equivalentPricePerKg: 2.0,
          minOrderQuantity: 1,
          availableStock: 0,
          isActive: true
        }
      ];

      // Shop 3 is out of stock (availableStock = 0), so lowest among in-stock is Shop 2 (3.00 AED/kg)
      assert.strictEqual(computeLowestPricePerKg(offers), 3.0);
    });
  });

  // ==========================================================================
  // 3. Public Catalog Endpoints (GET /api/v1/products)
  // ==========================================================================
  describe('3. Public Catalog Query & Filtering (GET /api/v1/products)', () => {
    beforeEach(async () => {
      // Seed test shops
      await createShop({
        name: 'Al Barakah Wholesale Produce',
        stallNumber: 'Block B, Stall 12',
        ownerId: 'usr_vendor_1',
        tradeLicenseNumber: 'TL-123456',
        phone: '+971501112233',
        isApproved: true,
        isActive: true
      });

      // Seed test produce products
      await createProduct({
        name: 'Valencia Oranges',
        category: ProductCategory.CITRUS,
        originCountry: 'Egypt',
        description: 'Juicy wholesale oranges in 15kg cartons',
        offers: [
          {
            shopId: 'shop_1',
            shopName: 'Al Barakah Wholesale Produce',
            stallNumber: 'Block B, Stall 12',
            unit: WholesaleUnit.CARTON,
            unitWeightKg: 15,
            priceAed: 45, // 3.00 AED/kg
            minOrderQuantity: 5,
            availableStock: 100
          }
        ]
      });

      await createProduct({
        name: 'Lebanese Beef Tomatoes',
        category: ProductCategory.FRESH_VEGETABLES,
        originCountry: 'Lebanon',
        description: 'Firm greenhouse tomatoes in 8kg crates',
        offers: [
          {
            shopId: 'shop_1',
            shopName: 'Al Barakah Wholesale Produce',
            stallNumber: 'Block B, Stall 12',
            unit: WholesaleUnit.CRATE,
            unitWeightKg: 8,
            priceAed: 32, // 4.00 AED/kg
            minOrderQuantity: 2,
            availableStock: 60
          }
        ]
      });

      await createProduct({
        name: 'Cavendish Bananas',
        category: ProductCategory.FRESH_FRUITS,
        originCountry: 'Ecuador',
        description: 'Export grade bananas in 13kg boxes',
        offers: [
          {
            shopId: 'shop_1',
            shopName: 'Al Barakah Wholesale Produce',
            stallNumber: 'Block B, Stall 12',
            unit: WholesaleUnit.BOX,
            unitWeightKg: 13,
            priceAed: 65, // 5.00 AED/kg
            minOrderQuantity: 3,
            availableStock: 40
          }
        ]
      });
    });

    it('returns list of products sorted by lowestPriceAedPerKg ascending', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/products'
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.statusCode, 200);
      assert.strictEqual(body.products.length, 3);
      assert.strictEqual(body.pagination.total, 3);

      // Verify sorting: 3.00 AED/kg (Oranges) < 4.00 AED/kg (Tomatoes) < 5.00 AED/kg (Bananas)
      assert.strictEqual(body.products[0].name, 'Valencia Oranges');
      assert.strictEqual(body.products[0].lowestPriceAedPerKg, 3.0);
      assert.strictEqual(body.products[1].name, 'Lebanese Beef Tomatoes');
      assert.strictEqual(body.products[1].lowestPriceAedPerKg, 4.0);
      assert.strictEqual(body.products[2].name, 'Cavendish Bananas');
      assert.strictEqual(body.products[2].lowestPriceAedPerKg, 5.0);
    });

    it('filters products accurately by category', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/products?category=citrus'
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.products.length, 1);
      assert.strictEqual(body.products[0].name, 'Valencia Oranges');
      assert.strictEqual(body.products[0].category, 'citrus');
    });

    it('rejects invalid category query with 400 Bad Request', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/products?category=invalid_category_xyz'
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /Invalid produce category/i);
    });

    it('searches products by text keyword in name or description', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/products?search=greenhouse'
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.products.length, 1);
      assert.strictEqual(body.products[0].name, 'Lebanese Beef Tomatoes');
    });

    it('supports pagination parameters (page, limit)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/products?page=1&limit=2'
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.products.length, 2);
      assert.strictEqual(body.pagination.page, 1);
      assert.strictEqual(body.pagination.limit, 2);
      assert.strictEqual(body.pagination.total, 3);
      assert.strictEqual(body.pagination.totalPages, 2);
    });
  });

  // ==========================================================================
  // 4. Product Details Endpoint (GET /api/v1/products/:id)
  // ==========================================================================
  describe('4. Product Details (GET /api/v1/products/:id)', () => {
    it('returns full product details and offers for valid ID', async () => {
      const created = await createProduct({
        name: 'Oman Fresh Pomegranates',
        category: ProductCategory.FRESH_FRUITS,
        originCountry: 'Oman',
        description: 'Sweet red pomegranates',
        offers: [
          {
            shopId: 'shop_oman_1',
            shopName: 'Jabal Akhdar Produce',
            stallNumber: 'Stall A-05',
            unit: WholesaleUnit.CRATE,
            unitWeightKg: 10,
            priceAed: 70,
            minOrderQuantity: 1,
            availableStock: 25
          }
        ]
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/products/${created.id}`
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.product.name, 'Oman Fresh Pomegranates');
      assert.strictEqual(body.product.offers.length, 1);
      assert.strictEqual(body.product.offers[0].shopName, 'Jabal Akhdar Produce');
      assert.strictEqual(body.product.offers[0].equivalentPricePerKg, 7.0);
    });

    it('returns 404 Not Found for non-existent product ID', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/products/non_existent_prod_999'
      });

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /not found/i);
    });
  });

  // ==========================================================================
  // 5. Order Model & Server Price Authority
  // ==========================================================================
  describe('5. Order Model Server Price Authority', () => {
    it('creates order record with server-calculated line totals and total order amount', async () => {
      const order = await createOrderRecord({
        buyerId: 'usr_buyer_101',
        shopId: 'shop_aweer_12',
        shopName: 'Al Barakah Fruits LLC',
        stallNumber: 'Stall B-12',
        deliveryType: DeliveryType.SCHEDULED_DELIVERY,
        deliveryAddress: 'Al Quoz Industrial Area 3, Dubai',
        items: [
          {
            productId: 'prod_orange_1',
            name: 'Valencia Oranges',
            unit: WholesaleUnit.CARTON,
            unitWeightKg: 15,
            quantity: 5,
            unitPriceAed: 45 // 5 * 45 = 225
          },
          {
            productId: 'prod_tomato_1',
            name: 'Lebanese Tomatoes',
            unit: WholesaleUnit.CRATE,
            unitWeightKg: 8,
            quantity: 3,
            unitPriceAed: 32 // 3 * 32 = 96
          }
        ]
      });

      assert.ok(order.id);
      assert.match(order.orderNumber, /^AWR-\d{8}-[A-Z0-9]+$/);
      assert.strictEqual(order.items.length, 2);
      assert.strictEqual(order.items[0].lineTotalAed, 225);
      assert.strictEqual(order.items[1].lineTotalAed, 96);
      assert.strictEqual(order.totalAmountAed, 321); // 225 + 96 = 321
      assert.strictEqual(order.status, 'pending');

      const retrievedOrders = await findOrdersByBuyerId('usr_buyer_101');
      assert.strictEqual(retrievedOrders.length, 1);
      assert.strictEqual(retrievedOrders[0].orderNumber, order.orderNumber);
    });
  });

  // ==========================================================================
  // 6. Production Fail-Closed Behavior on Database Disconnect
  // ==========================================================================
  describe('6. Fail-Closed Protection Outside Test Mode', () => {
    it('throws DatabaseUnavailableError when attempting repository operations outside test mode with DB offline', async () => {
      process.env.NODE_ENV = 'production';

      await assert.rejects(
        async () => {
          await findProducts();
        },
        (err: Error) => {
          return err.message.includes('fail-closed mode');
        }
      );

      await assert.rejects(
        async () => {
          await findProductById('any_id');
        },
        (err: Error) => {
          return err.message.includes('fail-closed mode');
        }
      );
    });
  });

  // ==========================================================================
  // 7. Public Stall Storefronts (GET /api/v1/shops & GET /api/v1/shops/:id)
  // ==========================================================================
  describe('7. Public Stall Storefronts', () => {
    it('returns only approved active shops via GET /api/v1/shops', async () => {
      await createShop({
        name: 'Approved Stall A',
        stallNumber: 'Stall A-01',
        ownerId: 'owner_appr',
        tradeLicenseNumber: 'TL-9001',
        phone: '+971500000001',
        isApproved: true,
        isActive: true
      });

      await createShop({
        name: 'Pending Stall B',
        stallNumber: 'Stall B-02',
        ownerId: 'owner_pend',
        tradeLicenseNumber: 'TL-9002',
        phone: '+971500000002',
        isApproved: false,
        isActive: true
      });

      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/shops'
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.shops.length, 1);
      assert.strictEqual(body.shops[0].name, 'Approved Stall A');
      assert.strictEqual(body.shops[0].isApproved, true);
    });

    it('returns stall profile and active produce offers via GET /api/v1/shops/:id', async () => {
      const shop = await createShop({
        name: 'Emirates Fresh Fruits LLC',
        stallNumber: 'Block C, Stall 09',
        ownerId: 'owner_emf',
        tradeLicenseNumber: 'TL-9003',
        phone: '+971509998877',
        isApproved: true,
        isActive: true
      });

      await createProduct({
        name: 'Fresh Mangoes Chaunsa',
        category: ProductCategory.FRESH_FRUITS,
        originCountry: 'Pakistan',
        offers: [
          {
            shopId: shop.id,
            shopName: shop.name,
            stallNumber: shop.stallNumber,
            unit: WholesaleUnit.CARTON,
            unitWeightKg: 5,
            priceAed: 35,
            availableStock: 50
          }
        ]
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/shops/${shop.id}`
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.shop.name, 'Emirates Fresh Fruits LLC');
      assert.strictEqual(body.shop.stallNumber, 'Block C, Stall 09');
      assert.strictEqual(body.products.length, 1);
      assert.strictEqual(body.products[0].name, 'Fresh Mangoes Chaunsa');
      assert.strictEqual(body.products[0].offers[0].priceAed, 35);
      assert.strictEqual(body.products[0].offers[0].equivalentPricePerKg, 7.0);
    });

    it('rejects unapproved stall profile access with 404 Not Found', async () => {
      const unapprovedShop = await createShop({
        name: 'Unapproved Stall',
        stallNumber: 'Stall X-99',
        ownerId: 'owner_unappr',
        tradeLicenseNumber: 'TL-9999',
        phone: '+971501119999',
        isApproved: false,
        isActive: true
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/shops/${unapprovedShop.id}`
      });

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /not approved/i);
    });
  });
});
