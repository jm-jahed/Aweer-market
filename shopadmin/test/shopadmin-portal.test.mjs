/**
 * AweerMarket Shop Admin Portal Unit & Contract Tests
 * Uses native Node.js test runner (node --test) without external dependencies.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  vendorRegister,
  vendorLogin,
  getVendorMe,
  vendorLogout,
  getVendorShop,
  updateVendorShop,
  getVendorProducts,
  createVendorProduct,
  updateVendorOffer,
  ApiClientError
} from '../src/lib/api-client.ts';

describe('Step 4: Shop Admin Portal API Client Tests', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockVendorUser = {
    id: 'usr_vendor_001',
    email: 'dates@al-aweer.ae',
    fullName: 'Hamdan Al Maktoum',
    role: 'shop_admin',
    shopId: 'shop_stall_42',
    businessName: 'Al Aweer Royal Dates LLC',
    phone: '+971501112233',
    isActive: true,
    isEmailVerified: false,
    createdAt: '2026-10-23T00:00:00.000Z'
  };

  const mockShop = {
    id: 'shop_stall_42',
    name: 'Al Aweer Royal Dates LLC',
    slug: 'al-aweer-royal-dates-llc',
    stallNumber: 'ST-42',
    phone: '+971501112233',
    isApproved: false,
    isActive: true,
    createdAt: '2026-10-23T00:00:00.000Z'
  };

  // 1. Vendor Registration
  describe('Vendor Registration Flow', () => {
    it('registers new vendor and creates stall record with isApproved: false', async () => {
      let capturedUrl = '';
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return new Response(
          JSON.stringify({
            statusCode: 201,
            message: 'Vendor registration successful',
            user: mockVendorUser,
            shop: mockShop
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const result = await vendorRegister({
        fullName: 'Hamdan Al Maktoum',
        email: 'dates@al-aweer.ae',
        password: 'VendorSecretPass123',
        stallName: 'Al Aweer Royal Dates LLC',
        stallNumber: 'ST-42',
        tradeLicenseNumber: 'TL-DXB-424242',
        phone: '+971501112233'
      });

      assert.strictEqual(result.statusCode, 201);
      assert.strictEqual(result.user.role, 'shop_admin');
      assert.strictEqual(result.shop.stallNumber, 'ST-42');
      assert.strictEqual(result.shop.isApproved, false);
      assert.ok(capturedUrl.endsWith('/auth/vendor/register'));
      assert.strictEqual(capturedOptions.method, 'POST');
      assert.strictEqual(capturedOptions.credentials, 'include');
    });

    it('rejects duplicate registration with 409 Conflict', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ statusCode: 409, error: 'Conflict', message: 'An account with this email already exists' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await vendorRegister({
            fullName: 'Duplicate',
            email: 'duplicate@al-aweer.ae',
            password: 'Pass12345678',
            stallName: 'Stall',
            stallNumber: 'ST-01',
            tradeLicenseNumber: 'TL-11111',
            phone: '+971500000000'
          });
        },
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 409);
          return true;
        }
      );
    });
  });

  // 2. Vendor Login & Session Restoration
  describe('Vendor Login & Session', () => {
    it('authenticates valid vendor and sets session cookie (HTTP 200)', async () => {
      globalThis.fetch = async (url, options) => {
        assert.ok(url.endsWith('/auth/vendor/login'));
        assert.strictEqual(options.method, 'POST');
        return new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Vendor login successful',
            user: mockVendorUser,
            shop: mockShop
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const result = await vendorLogin('dates@al-aweer.ae', 'VendorSecretPass123');
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.user.email, 'dates@al-aweer.ae');
      assert.strictEqual(result.shop.stallNumber, 'ST-42');
    });

    it('restores vendor session via GET /auth/vendor/me', async () => {
      globalThis.fetch = async (url) => {
        assert.ok(url.endsWith('/auth/vendor/me'));
        return new Response(
          JSON.stringify({
            statusCode: 200,
            user: mockVendorUser,
            shop: mockShop
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const result = await getVendorMe();
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.user.role, 'shop_admin');
      assert.strictEqual(result.shop.id, 'shop_stall_42');
    });

    it('logs out vendor and clears session cookie via /auth/logout', async () => {
      let called = false;
      globalThis.fetch = async (url, options) => {
        assert.ok(url.endsWith('/auth/logout'));
        assert.strictEqual(options.method, 'POST');
        called = true;
        return new Response(
          JSON.stringify({ statusCode: 200, message: 'Logged out successfully' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await vendorLogout();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(called, true);
    });
  });

  // 3. Stall Management (GET & PATCH /vendor/shop)
  describe('Stall Management', () => {
    it('retrieves vendor stall details from GET /vendor/shop', async () => {
      globalThis.fetch = async (url) => {
        assert.ok(url.endsWith('/vendor/shop'));
        return new Response(
          JSON.stringify({ statusCode: 200, shop: mockShop }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getVendorShop();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.shop.name, 'Al Aweer Royal Dates LLC');
      assert.strictEqual(res.shop.stallNumber, 'ST-42');
    });

    it('updates stall contact details via PATCH /vendor/shop', async () => {
      let capturedBody = null;
      globalThis.fetch = async (url, options) => {
        assert.ok(url.endsWith('/vendor/shop'));
        assert.strictEqual(options.method, 'PATCH');
        capturedBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Shop details updated successfully',
            shop: { ...mockShop, name: 'Al Aweer Premium Dates LLC', phone: '+971509998877' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await updateVendorShop({
        name: 'Al Aweer Premium Dates LLC',
        phone: '+971509998877'
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(capturedBody.name, 'Al Aweer Premium Dates LLC');
      assert.strictEqual(res.shop.name, 'Al Aweer Premium Dates LLC');
      assert.strictEqual(res.shop.phone, '+971509998877');
    });
  });

  // 4. Produce & Inventory Management (Step 5)
  describe('Produce & Inventory Management', () => {
    it('fetches vendor products via GET /vendor/products', async () => {
      globalThis.fetch = async (url) => {
        assert.ok(url.endsWith('/vendor/products'));
        return new Response(
          JSON.stringify({
            statusCode: 200,
            products: [
              {
                id: 'prod_orange_001',
                name: 'Valencia Oranges',
                category: 'citrus',
                originCountry: 'Egypt',
                description: 'Boxes of sweet oranges',
                lowestPriceAedPerKg: 3.0,
                offer: {
                  shopId: 'shop_stall_42',
                  shopName: 'Al Aweer Royal Dates LLC',
                  stallNumber: 'ST-42',
                  unit: 'box',
                  unitWeightKg: 15,
                  priceAed: 45,
                  equivalentPricePerKg: 3.0,
                  minOrderQuantity: 5,
                  availableStock: 100,
                  isActive: true
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getVendorProducts();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.products.length, 1);
      assert.strictEqual(res.products[0].name, 'Valencia Oranges');
      assert.strictEqual(res.products[0].offer?.equivalentPricePerKg, 3.0);
    });

    it('creates new produce offer via POST /vendor/products', async () => {
      let capturedBody = null;
      globalThis.fetch = async (url, options) => {
        assert.ok(url.endsWith('/vendor/products'));
        assert.strictEqual(options.method, 'POST');
        capturedBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            statusCode: 201,
            message: 'Produce offer added to catalog successfully',
            product: {
              id: 'prod_banana_002',
              name: 'Cavendish Bananas',
              category: 'exotic_produce',
              originCountry: 'Ecuador',
              description: '',
              lowestPriceAedPerKg: 2.5,
              offers: []
            }
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await createVendorProduct({
        name: 'Cavendish Bananas',
        category: 'exotic_produce',
        originCountry: 'Ecuador',
        description: '',
        offer: {
          unit: 'crate',
          unitWeightKg: 20,
          priceAed: 50,
          minOrderQuantity: 5,
          availableStock: 150
        }
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(capturedBody.name, 'Cavendish Bananas');
      assert.strictEqual(res.product.lowestPriceAedPerKg, 2.5);
    });

    it('updates existing offer price and stock via PATCH /vendor/products/:id/offer', async () => {
      let capturedBody = null;
      globalThis.fetch = async (url, options) => {
        assert.ok(url.endsWith('/vendor/products/prod_123/offer'));
        assert.strictEqual(options.method, 'PATCH');
        capturedBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Offer updated successfully',
            product: {
              id: 'prod_123',
              name: 'Red Onions',
              lowestPriceAedPerKg: 2.0
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await updateVendorOffer('prod_123', {
        priceAed: 20,
        availableStock: 120
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(capturedBody.priceAed, 20);
      assert.strictEqual(capturedBody.availableStock, 120);
      assert.strictEqual(res.product.lowestPriceAedPerKg, 2.0);
    });
  });
});

