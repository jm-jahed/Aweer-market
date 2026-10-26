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
  getVendorOrders,
  updateVendorOrderStatus,
  uploadProductImage,
  deleteProductImage,
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

    it('creates product using 8-field form structure with derived unitWeightKg and unit piece/bunch', async () => {
      let capturedBody = null;
      globalThis.fetch = async (url, options) => {
        assert.ok(url.endsWith('/vendor/products'));
        capturedBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            statusCode: 201,
            message: 'Produce offer added to catalog successfully',
            product: {
              id: 'prod_mint_003',
              name: 'Fresh Spearmint Bunches',
              category: 'leafy_greens',
              originCountry: 'UAE',
              description: 'Fresh Spearmint Bunches sourced directly from UAE.',
              lowestPriceAedPerKg: 10.0,
              offers: []
            }
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      };

      // 8 approved fields: Name, Category, Origin, Image, Selling Price, Unit, MOQ, Stock
      const res = await createVendorProduct({
        name: 'Fresh Spearmint Bunches',
        category: 'leafy_greens',
        originCountry: 'UAE',
        description: 'Fresh Spearmint Bunches sourced directly from UAE.',
        imageUrl: '/images/hero-basket.jpg',
        offer: {
          unit: 'bunch',
          unitWeightKg: 0.25, // derived for bunch
          priceAed: 2.5,
          minOrderQuantity: 10,
          availableStock: 300
        }
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(capturedBody.name, 'Fresh Spearmint Bunches');
      assert.strictEqual(capturedBody.category, 'leafy_greens');
      assert.strictEqual(capturedBody.originCountry, 'UAE');
      assert.strictEqual(capturedBody.imageUrl, '/images/hero-basket.jpg');
      assert.strictEqual(capturedBody.offer.unit, 'bunch');
      assert.strictEqual(capturedBody.offer.priceAed, 2.5);
      assert.strictEqual(capturedBody.offer.minOrderQuantity, 10);
      assert.strictEqual(capturedBody.offer.availableStock, 300);
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

  // 5. Order Management & Vendor Fulfillment (Step 8)
  describe('Order Management & Vendor Fulfillment', () => {
    const mockOrders = [
      {
        id: 'ord_vendor_001',
        orderNumber: 'AWEER-20261023-V001',
        buyerId: 'usr_buyer_999',
        shopId: 'shop_stall_42',
        shopName: 'Al Aweer Royal Dates LLC',
        stallNumber: 'ST-42',
        deliveryType: 'delivery',
        deliveryAddress: 'Deira Fish & Vegetable Market, Stall 12',
        status: 'pending',
        totalAmountAed: 150,
        items: [
          {
            productId: 'prod_orange_001',
            name: 'Valencia Oranges',
            unit: 'box',
            unitWeightKg: 15,
            quantity: 3,
            unitPriceAed: 50,
            lineTotalAed: 150
          }
        ],
        createdAt: '2026-10-23T01:00:00.000Z',
        updatedAt: '2026-10-23T01:00:00.000Z'
      }
    ];

    it('fetches incoming stall orders via GET /vendor/orders', async () => {
      let capturedUrl = '';
      globalThis.fetch = async (url) => {
        capturedUrl = url;
        return new Response(
          JSON.stringify({ statusCode: 200, orders: mockOrders }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getVendorOrders();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.orders.length, 1);
      assert.strictEqual(res.orders[0].orderNumber, 'AWEER-20261023-V001');
      assert.strictEqual(res.orders[0].totalAmountAed, 150);
      assert.ok(capturedUrl.endsWith('/vendor/orders'));
    });

    it('updates order status via PATCH /vendor/orders/:id/status (e.g. confirmed)', async () => {
      let capturedUrl = '';
      let capturedBody = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedBody = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Order status updated successfully',
            order: { ...mockOrders[0], status: 'confirmed', updatedAt: '2026-10-23T01:10:00.000Z' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await updateVendorOrderStatus('ord_vendor_001', 'confirmed');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(capturedBody.status, 'confirmed');
      assert.strictEqual(res.order.status, 'confirmed');
      assert.ok(capturedUrl.endsWith('/vendor/orders/ord_vendor_001/status'));
    });

    it('handles cancellation and propagates ApiClientError if rejection occurs', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'Invalid status transition' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await updateVendorOrderStatus('ord_vendor_001', 'invalid_status');
        },
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.message, 'Invalid status transition');
          return true;
        }
      );
    });
  });

  // 6. UAE VAT Calculations (5% Inclusive vs Exclusive)
  describe('VAT Calculations & Invoicing Math', () => {
    it('calculates 5% inclusive VAT correctly for a Dhs 100 total producing Dhs 4.76 VAT', () => {
      const totalAmountAed = 100;
      const subtotal = totalAmountAed / 1.05;
      const vatInclusive = totalAmountAed - subtotal;

      assert.strictEqual(subtotal.toFixed(2), '95.24');
      assert.strictEqual(vatInclusive.toFixed(2), '4.76');
      assert.strictEqual((Number(subtotal.toFixed(2)) + Number(vatInclusive.toFixed(2))).toFixed(2), '100.00');
    });

    it('calculates 5% exclusive VAT correctly for personal direct stall line items', () => {
      const lineTotal = 100;
      const vatExclusive = lineTotal * 0.05;
      const grandTotal = lineTotal + vatExclusive;

      assert.strictEqual(vatExclusive.toFixed(2), '5.00');
      assert.strictEqual(grandTotal.toFixed(2), '105.00');
    });
  });

  // 7. Cloudflare R2 Product Image Upload API Client
  describe('Product Image Upload to Cloudflare R2 via Backend', () => {
    it('uploads image via multipart form and receives public HTTPS URL', async () => {
      let capturedUrl = '';
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return new Response(
          JSON.stringify({
            statusCode: 201,
            message: 'Product image uploaded to Cloudflare R2 successfully',
            url: 'https://images.aweermarket.ae/products/shop_stall_42/produce-123.jpg',
            key: 'products/shop_stall_42/produce-123.jpg',
            size: 20480,
            mimeType: 'image/jpeg'
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      };

      // Mock File object
      const mockFile = new Blob(['fake image bytes'], { type: 'image/jpeg' });
      const res = await uploadProductImage(mockFile);

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.url, 'https://images.aweermarket.ae/products/shop_stall_42/produce-123.jpg');
      assert.strictEqual(res.key, 'products/shop_stall_42/produce-123.jpg');
      assert.strictEqual(capturedOptions.method, 'POST');
      assert.strictEqual(capturedOptions.credentials, 'include');
      assert.ok(capturedUrl.endsWith('/vendor/upload'));
    });

    it('propagates ApiClientError when backend rejects invalid or oversized image', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 400,
            error: 'Bad Request',
            message: 'File size exceeds maximum allowed limit of 5 MiB.'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const mockFile = new Blob(['oversized'], { type: 'image/jpeg' });
      await assert.rejects(
        async () => {
          await uploadProductImage(mockFile);
        },
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /5 MiB/i);
          return true;
        }
      );
    });

    it('propagates ApiClientError when R2 is not configured on server (503)', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 503,
            error: 'Service Unavailable',
            message: 'Cloudflare R2 storage credentials are not configured on server'
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const mockFile = new Blob(['bytes'], { type: 'image/jpeg' });
      await assert.rejects(
        async () => {
          await uploadProductImage(mockFile);
        },
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 503);
          assert.match(err.message, /Cloudflare R2 storage credentials are not configured/i);
          return true;
        }
      );
    });

    it('deletes draft image successfully via DELETE /vendor/upload', async () => {
      let capturedUrl = '';
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Product image deleted successfully from Cloudflare R2',
            key: 'products/shop_stall_42/produce-uuid-123.jpg'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await deleteProductImage('products/shop_stall_42/produce-uuid-123.jpg');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.key, 'products/shop_stall_42/produce-uuid-123.jpg');
      assert.strictEqual(capturedOptions.method, 'DELETE');
      assert.strictEqual(capturedOptions.credentials, 'include');
      assert.ok(capturedUrl.endsWith('/vendor/upload'));
      assert.strictEqual(JSON.parse(capturedOptions.body).key, 'products/shop_stall_42/produce-uuid-123.jpg');
    });

    it('propagates ApiClientError when image deletion fails or key is unauthorized', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 403,
            error: 'Forbidden',
            message: 'Cannot delete image outside of your authorized shop namespace'
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await deleteProductImage('products/victim_shop/secret.jpg');
        },
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /outside of your authorized shop namespace/i);
          return true;
        }
      );
    });
  });
});



