import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { buildServer } from './server.js';
import { resetInMemoryUsers } from './models/user.model.js';
import { resetInMemoryShops } from './models/shop.model.js';
import { resetInMemoryProducts } from './models/product.model.js';
import { UserRole, WholesaleUnit, ProductCategory } from '@aweermarket/types';

describe('AweerMarket Step 4 — Shop Admin & Vendor Foundation', () => {
  let app: FastifyInstance;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'super-test-secret-at-least-32-chars-long-12345';
    process.env.JWT_SECRET_BUYER = 'buyer-secret-must-be-at-least-32-chars-long-abc';
    process.env.JWT_SECRET_SHOP_ADMIN = 'shop-admin-secret-at-least-32-chars-long-def';
    process.env.JWT_SECRET_SUPER_ADMIN = 'super-admin-secret-at-least-32-chars-long-xyz';

    app = await buildServer();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => {
    resetInMemoryUsers();
    resetInMemoryShops();
    resetInMemoryProducts();
  });

  // ==========================================================================
  // 1. Vendor Registration Flow
  // ==========================================================================
  describe('1. Vendor Registration (POST /api/v1/auth/vendor/register)', () => {
    it('registers vendor, creates shop with isApproved: false, and sets cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: {
          email: 'stall10@al-aweer.ae',
          password: 'VendorSecretPass123',
          fullName: 'Saeed Al Maktoum',
          stallName: 'Al Aweer Royal Dates LLC',
          stallNumber: 'ST-10',
          tradeLicenseNumber: 'TL-DXB-101010',
          phone: '+971501010101'
        }
      });

      assert.strictEqual(res.statusCode, 201);
      const body = res.json();
      assert.strictEqual(body.user.email, 'stall10@al-aweer.ae');
      assert.strictEqual(body.user.role, UserRole.SHOP_ADMIN);
      assert.strictEqual(body.shop.name, 'Al Aweer Royal Dates LLC');
      assert.strictEqual(body.shop.stallNumber, 'ST-10');
      // Crucial: Must be unapproved by default
      assert.strictEqual(body.shop.isApproved, false);

      const cookie = res.headers['set-cookie'];
      assert.ok(cookie);
      assert.ok(String(cookie).includes('aweer_session='));
    });

    it('rejects duplicate vendor registration with 409 Conflict', async () => {
      const vendorData = {
        email: 'duplicate@al-aweer.ae',
        password: 'Password123!',
        fullName: 'Vendor Name',
        stallName: 'Unique Stall Name',
        stallNumber: 'ST-11',
        tradeLicenseNumber: 'TL-11111',
        phone: '+971501111111'
      };

      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: vendorData
      });

      const dupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: vendorData
      });

      assert.strictEqual(dupRes.statusCode, 409);
    });

    it('rejects client attempt to self-approve or inject super_admin role during registration', async () => {
      const maliciousPayload = {
        email: 'hacker@example.com',
        password: 'Password123!',
        fullName: 'Malicious Vendor',
        stallName: 'Hacked Stall',
        stallNumber: 'ST-99',
        tradeLicenseNumber: 'TL-99999',
        phone: '+971509999999',
        role: 'super_admin',
        isApproved: true
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: maliciousPayload
      });

      assert.strictEqual(res.statusCode, 400);
      assert.ok(res.json().message.toLowerCase().includes('unrecognized'));
    });
  });

  // ==========================================================================
  // 2. Vendor Login & Role Scope Enforcement
  // ==========================================================================
  describe('2. Vendor Login (POST /api/v1/auth/vendor/login)', () => {
    beforeEach(async () => {
      // Register standard vendor
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: {
          email: 'active.vendor@al-aweer.ae',
          password: 'VendorSecretPass123',
          fullName: 'Active Vendor',
          stallName: 'Fresh Fruits Stall',
          stallNumber: 'ST-05',
          tradeLicenseNumber: 'TL-55555',
          phone: '+971505555555'
        }
      });

      // Register standard buyer
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'buyer@example.com',
          password: 'BuyerPassword123',
          fullName: 'Buyer User',
          phone: '+971500000000'
        }
      });
    });

    it('authenticates valid vendor and returns user with shop details', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/login',
        payload: {
          email: 'active.vendor@al-aweer.ae',
          password: 'VendorSecretPass123'
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.user.role, UserRole.SHOP_ADMIN);
      assert.strictEqual(body.shop.stallNumber, 'ST-05');
      assert.ok(res.headers['set-cookie']);
    });

    it('rejects wrong vendor password with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/login',
        payload: {
          email: 'active.vendor@al-aweer.ae',
          password: 'WrongPassword999'
        }
      });

      assert.strictEqual(res.statusCode, 401);
    });

    it('REJECTS buyer user attempting vendor login (Role Enforcement)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/login',
        payload: {
          email: 'buyer@example.com',
          password: 'BuyerPassword123'
        }
      });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.json().message, 'Invalid email or password');
    });
  });

  // ==========================================================================
  // 3. Vendor Session Restoration (GET /api/v1/auth/vendor/me)
  // ==========================================================================
  describe('3. Vendor Session Restoration (GET /api/v1/auth/vendor/me)', () => {
    it('restores vendor session when cookie is valid', async () => {
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: {
          email: 'restore.vendor@al-aweer.ae',
          password: 'VendorSecretPass123',
          fullName: 'Restore Vendor',
          stallName: 'Restore Stall',
          stallNumber: 'ST-08',
          tradeLicenseNumber: 'TL-88888',
          phone: '+971508888888'
        }
      });

      const cookie = regRes.headers['set-cookie'] as string;

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/vendor/me',
        headers: { cookie }
      });

      assert.strictEqual(meRes.statusCode, 200);
      const body = meRes.json();
      assert.strictEqual(body.user.email, 'restore.vendor@al-aweer.ae');
      assert.strictEqual(body.shop.stallNumber, 'ST-08');
    });

    it('rejects restoration when no cookie is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/vendor/me'
      });

      assert.strictEqual(res.statusCode, 401);
    });
  });

  // ==========================================================================
  // 4. Vendor Stall Management & Multi-Tenant Scoping
  // ==========================================================================
  describe('4. Stall Management & Multi-Tenant Isolation', () => {
    let vendorACookie: string;
    let vendorBCookie: string;

    beforeEach(async () => {
      // Vendor A
      const resA = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: {
          email: 'vendorA@al-aweer.ae',
          password: 'PasswordA123!',
          fullName: 'Vendor A',
          stallName: 'Stall A Wholesale',
          stallNumber: 'ST-A1',
          tradeLicenseNumber: 'TL-A111',
          phone: '+971501111111'
        }
      });
      vendorACookie = resA.headers['set-cookie'] as string;

      // Vendor B
      const resB = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: {
          email: 'vendorB@al-aweer.ae',
          password: 'PasswordB123!',
          fullName: 'Vendor B',
          stallName: 'Stall B Wholesale',
          stallNumber: 'ST-B2',
          tradeLicenseNumber: 'TL-B222',
          phone: '+971502222222'
        }
      });
      vendorBCookie = resB.headers['set-cookie'] as string;
    });

    it('Vendor A retrieves only their own shop details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/vendor/shop',
        headers: { cookie: vendorACookie }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.shop.name, 'Stall A Wholesale');
      assert.strictEqual(body.shop.stallNumber, 'ST-A1');
    });

    it('Vendor A updates their stall without modifying Vendor B stall', async () => {
      const updateRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/vendor/shop',
        headers: { cookie: vendorACookie },
        payload: {
          name: 'Stall A Premium Wholesale',
          phone: '+971509990000'
        }
      });

      assert.strictEqual(updateRes.statusCode, 200);
      assert.strictEqual(updateRes.json().shop.name, 'Stall A Premium Wholesale');
      assert.strictEqual(updateRes.json().shop.phone, '+971509990000');

      // Verify Vendor B was NOT touched (Multi-tenant isolation)
      const resB = await app.inject({
        method: 'GET',
        url: '/api/v1/vendor/shop',
        headers: { cookie: vendorBCookie }
      });
      assert.strictEqual(resB.json().shop.name, 'Stall B Wholesale');
      assert.strictEqual(resB.json().shop.phone, '+971502222222');
    });

    it('REJECTS attempt to self-approve stall via PATCH /vendor/shop', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/vendor/shop',
        headers: { cookie: vendorACookie },
        payload: {
          name: 'Stall A Trying to Self Approve',
          isApproved: true // Illegal field
        }
      });

      assert.strictEqual(res.statusCode, 400);
      assert.ok(res.json().message.toLowerCase().includes('unrecognized'));

      // Confirm isApproved is still false
      const checkRes = await app.inject({
        method: 'GET',
        url: '/api/v1/vendor/shop',
        headers: { cookie: vendorACookie }
      });
      assert.strictEqual(checkRes.json().shop.isApproved, false);
    });

    it('REJECTS non-vendor access to /api/v1/vendor/shop with 403 Forbidden', async () => {
      // Buyer login
      const buyerReg = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'buyer.intruder@example.com',
          password: 'BuyerPass123!',
          fullName: 'Intruder Buyer',
          phone: '+971501234567'
        }
      });
      const buyerCookie = buyerReg.headers['set-cookie'] as string;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/vendor/shop',
        headers: { cookie: buyerCookie }
      });

      assert.strictEqual(res.statusCode, 403);
    });

    it('Vendor token cannot access Super Admin endpoints (SEC-02 Core Defense)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
        headers: { cookie: vendorACookie }
      });

      assert.strictEqual(res.statusCode, 403);
    });
  });

  // ==========================================================================
  // 5. Wholesale Produce Catalog & Offer Inventory Engine (Step 5)
  // ==========================================================================
  describe('5. Produce Catalog & Offer Inventory Engine', () => {
    let vendorACookie: string;
    let vendorBCookie: string;

    beforeEach(async () => {
      // Vendor A
      const resA = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: {
          email: 'produceA@al-aweer.ae',
          password: 'PasswordA123!',
          fullName: 'Vendor Produce A',
          stallName: 'Al Aweer Citrus Stall',
          stallNumber: 'ST-01',
          tradeLicenseNumber: 'TL-001',
          phone: '+971501111111'
        }
      });
      vendorACookie = resA.headers['set-cookie'] as string;

      // Vendor B
      const resB = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: {
          email: 'produceB@al-aweer.ae',
          password: 'PasswordB123!',
          fullName: 'Vendor Produce B',
          stallName: 'Emirates Wholesale Fruits',
          stallNumber: 'ST-02',
          tradeLicenseNumber: 'TL-002',
          phone: '+971502222222'
        }
      });
      vendorBCookie = resB.headers['set-cookie'] as string;
    });

    it('Vendor A lists a new produce item with wholesale unit and calculated AED/kg', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/products',
        headers: { cookie: vendorACookie },
        payload: {
          name: 'Valencia Oranges',
          category: ProductCategory.CITRUS,
          originCountry: 'Egypt',
          description: 'Export quality sweet Valencia oranges in wholesale boxes',
          offer: {
            unit: WholesaleUnit.BOX,
            unitWeightKg: 15,
            priceAed: 45, // 45 / 15 = 3.00 AED/kg
            minOrderQuantity: 5,
            availableStock: 100
          }
        }
      });

      assert.strictEqual(res.statusCode, 201);
      const body = res.json();
      assert.strictEqual(body.product.name, 'Valencia Oranges');
      assert.strictEqual(body.product.lowestPriceAedPerKg, 3.0);
      assert.strictEqual(body.product.offers.length, 1);
      assert.strictEqual(body.product.offers[0].equivalentPricePerKg, 3.0);
      assert.strictEqual(body.product.offers[0].availableStock, 100);
      assert.strictEqual(body.product.offers[0].stallNumber, 'ST-01');
    });

    it('Vendor B adds a cheaper offer for the same produce item; lowest price updates', async () => {
      // 1. Vendor A creates product at 3.00 AED/kg
      await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/products',
        headers: { cookie: vendorACookie },
        payload: {
          name: 'Cavendish Bananas',
          category: ProductCategory.EXOTIC_PRODUCE,
          originCountry: 'Ecuador',
          description: 'Class A green-tip bananas',
          offer: {
            unit: WholesaleUnit.BOX,
            unitWeightKg: 18.5,
            priceAed: 55.5, // 55.5 / 18.5 = 3.00 AED/kg
            minOrderQuantity: 10,
            availableStock: 80
          }
        }
      });

      // 2. Vendor B creates offer for the same "Cavendish Bananas" at 2.50 AED/kg
      const resB = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/products',
        headers: { cookie: vendorBCookie },
        payload: {
          name: 'Cavendish Bananas',
          category: ProductCategory.EXOTIC_PRODUCE,
          originCountry: 'Ecuador',
          offer: {
            unit: WholesaleUnit.CRATE,
            unitWeightKg: 20,
            priceAed: 50, // 50 / 20 = 2.50 AED/kg
            minOrderQuantity: 5,
            availableStock: 150
          }
        }
      });

      assert.strictEqual(resB.statusCode, 201);
      const product = resB.json().product;
      assert.strictEqual(product.name, 'Cavendish Bananas');
      // Multi-stall offers aggregated under single produce item
      assert.strictEqual(product.offers.length, 2);
      // Automatically re-computed lowestPriceAedPerKg
      assert.strictEqual(product.lowestPriceAedPerKg, 2.5);
    });

    it('Vendor updates their own offer price and stock (PATCH /api/v1/vendor/products/:id/offer)', async () => {
      // 1. Create produce
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/products',
        headers: { cookie: vendorACookie },
        payload: {
          name: 'Red Onions',
          category: ProductCategory.ROOT_VEGETABLES,
          originCountry: 'India',
          description: 'Nashik red onions in mesh bags',
          offer: {
            unit: WholesaleUnit.SACK,
            unitWeightKg: 10,
            priceAed: 25, // 2.50 AED/kg
            minOrderQuantity: 10,
            availableStock: 200
          }
        }
      });

      const prodId = createRes.json().product.id;

      // 2. Vendor A updates offer: price down to 20 AED (2.00 AED/kg) and stock down to 120
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/vendor/products/${prodId}/offer`,
        headers: { cookie: vendorACookie },
        payload: {
          priceAed: 20,
          availableStock: 120
        }
      });

      assert.strictEqual(patchRes.statusCode, 200);
      const updatedProduct = patchRes.json().product;
      assert.strictEqual(updatedProduct.lowestPriceAedPerKg, 2.0);
      assert.strictEqual(updatedProduct.offers[0].priceAed, 20);
      assert.strictEqual(updatedProduct.offers[0].availableStock, 120);
    });

    it('REJECTS Vendor B from modifying Vendor A offer (Tenant Scoping)', async () => {
      // Create product by Vendor A
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/products',
        headers: { cookie: vendorACookie },
        payload: {
          name: 'Vine Tomatoes',
          category: ProductCategory.FRESH_VEGETABLES,
          originCountry: 'UAE',
          offer: {
            unit: WholesaleUnit.BOX,
            unitWeightKg: 6,
            priceAed: 18,
            minOrderQuantity: 5,
            availableStock: 50
          }
        }
      });

      const prodId = createRes.json().product.id;

      // Vendor B attempts to update Vendor A's offer
      const maliciousPatch = await app.inject({
        method: 'PATCH',
        url: `/api/v1/vendor/products/${prodId}/offer`,
        headers: { cookie: vendorBCookie },
        payload: {
          priceAed: 1
        }
      });

      assert.strictEqual(maliciousPatch.statusCode, 403);
      assert.ok(maliciousPatch.json().message.includes('Access denied'));
    });

    it('Vendor retrieves only their own produce listings via GET /api/v1/vendor/products', async () => {
      // Vendor A lists Product 1
      await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/products',
        headers: { cookie: vendorACookie },
        payload: {
          name: 'Fresh Mint',
          category: ProductCategory.LEAFY_GREENS,
          originCountry: 'Oman',
          offer: {
            unit: WholesaleUnit.KG,
            unitWeightKg: 1,
            priceAed: 8,
            minOrderQuantity: 2,
            availableStock: 30
          }
        }
      });

      // Vendor A queries listings
      const resA = await app.inject({
        method: 'GET',
        url: '/api/v1/vendor/products',
        headers: { cookie: vendorACookie }
      });

      assert.strictEqual(resA.statusCode, 200);
      const prodsA = resA.json().products;
      assert.strictEqual(prodsA.length, 1);
      assert.strictEqual(prodsA[0].name, 'Fresh Mint');
      assert.strictEqual(prodsA[0].offer.unit, WholesaleUnit.KG);

      // Vendor B queries listings (should be empty for Vendor B)
      const resB = await app.inject({
        method: 'GET',
        url: '/api/v1/vendor/products',
        headers: { cookie: vendorBCookie }
      });

      assert.strictEqual(resB.statusCode, 200);
      assert.strictEqual(resB.json().products.length, 0);
    });

    it('Public catalog reflects added offers and computed AED/kg', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/vendor/products',
        headers: { cookie: vendorACookie },
        payload: {
          name: 'Al Aweer Premium Watermelons',
          category: ProductCategory.BERRIES,
          originCountry: 'UAE',
          offer: {
            unit: WholesaleUnit.PALLET,
            unitWeightKg: 500,
            priceAed: 750, // 750 / 500 = 1.50 AED/kg
            minOrderQuantity: 1,
            availableStock: 10
          }
        }
      });

      const catalogRes = await app.inject({
        method: 'GET',
        url: '/api/v1/products?category=berries'
      });

      assert.strictEqual(catalogRes.statusCode, 200);
      const catalog = catalogRes.json();
      assert.strictEqual(catalog.products.length, 1);
      assert.strictEqual(catalog.products[0].name, 'Al Aweer Premium Watermelons');
      assert.strictEqual(catalog.products[0].lowestPriceAedPerKg, 1.5);
    });
  });
});

