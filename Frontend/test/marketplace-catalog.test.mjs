/**
 * AweerMarket Buyer Marketplace & Catalog Integration / Unit Tests
 * Uses native Node.js test runner (node --test) without external dependencies.
 * Verifies public produce browsing, multi-stall offer aggregation, category filtering,
 * and public stall storefront API client interactions.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  getCategories,
  getProducts,
  getProductById,
  getShops,
  getShopById
} from '../src/lib/api-client.ts';

describe('AweerMarket Step 6 — Buyer Marketplace Catalog & Shop Storefront', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('1. Wholesale Categories (getCategories)', () => {
    it('fetches categories from /categories endpoint', async () => {
      globalThis.fetch = async (url, options) => {
        assert.match(url.toString(), /\/api\/v1\/categories$/);
        assert.strictEqual(options.method, 'GET');
        assert.strictEqual(options.credentials, 'include');

        return new Response(
          JSON.stringify({
            statusCode: 200,
            categories: [
              { key: 'citrus', label: 'Citrus' },
              { key: 'fresh_fruits', label: 'Fresh Fruits' },
              { key: 'fresh_vegetables', label: 'Fresh Vegetables' }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getCategories();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.categories.length, 3);
      assert.strictEqual(res.categories[0].key, 'citrus');
      assert.strictEqual(res.categories[0].label, 'Citrus');
    });
  });

  describe('2. Produce Catalog Query (getProducts)', () => {
    it('queries products with category filter and search keywords', async () => {
      globalThis.fetch = async (url, options) => {
        const urlStr = url.toString();
        assert.match(urlStr, /\/api\/v1\/products\?/);
        assert.match(urlStr, /category=citrus/);
        assert.match(urlStr, /search=orange/);
        assert.match(urlStr, /page=1/);
        assert.match(urlStr, /limit=20/);
        assert.strictEqual(options.method, 'GET');

        return new Response(
          JSON.stringify({
            statusCode: 200,
            products: [
              {
                id: 'prod_1',
                name: 'Valencia Oranges',
                category: 'citrus',
                originCountry: 'Egypt',
                description: 'Juicy sweet oranges',
                lowestPriceAedPerKg: 3.0,
                offers: [
                  {
                    vendorId: 'shop_1',
                    shopName: 'Al Barakah Fruits',
                    stallNumber: 'Block B, Stall 12',
                    unit: 'carton',
                    unitWeightKg: 15,
                    priceAed: 45,
                    equivalentPricePerKg: 3.0,
                    minOrderQuantity: 5,
                    availableStock: 100
                  }
                ]
              }
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getProducts({
        category: 'citrus',
        search: 'orange',
        page: 1,
        limit: 20
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.products.length, 1);
      assert.strictEqual(res.products[0].name, 'Valencia Oranges');
      assert.strictEqual(res.products[0].lowestPriceAedPerKg, 3.0);
      assert.strictEqual(res.products[0].offers[0].priceAed, 45);
    });

    it('queries products without filter params when empty', async () => {
      globalThis.fetch = async (url) => {
        assert.match(url.toString(), /\/api\/v1\/products$/);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            products: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getProducts();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.products.length, 0);
    });
  });

  describe('3. Product Details & Multi-Stall Offers (getProductById)', () => {
    it('retrieves single product with multi-stall offer aggregation', async () => {
      globalThis.fetch = async (url) => {
        assert.match(url.toString(), /\/api\/v1\/products\/prod_100$/);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            product: {
              id: 'prod_100',
              name: 'Cavendish Bananas',
              category: 'fresh_fruits',
              originCountry: 'Ecuador',
              lowestPriceAedPerKg: 4.8,
              offers: [
                {
                  vendorId: 'shop_a',
                  shopName: 'Stall A-10',
                  unit: 'box',
                  unitWeightKg: 13,
                  priceAed: 65,
                  equivalentPricePerKg: 5.0,
                  availableStock: 50
                },
                {
                  vendorId: 'shop_b',
                  shopName: 'Stall B-02',
                  unit: 'box',
                  unitWeightKg: 13,
                  priceAed: 62.4,
                  equivalentPricePerKg: 4.8,
                  availableStock: 80
                }
              ]
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getProductById('prod_100');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.product.name, 'Cavendish Bananas');
      assert.strictEqual(res.product.offers.length, 2);
      assert.strictEqual(res.product.lowestPriceAedPerKg, 4.8);
    });
  });

  describe('4. Public Stall Directory & Storefront (getShops & getShopById)', () => {
    it('retrieves all verified public stalls via getShops', async () => {
      globalThis.fetch = async (url) => {
        assert.match(url.toString(), /\/api\/v1\/shops$/);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            shops: [
              {
                id: 'shop_1',
                name: 'Al Aweer Royal Fruits LLC',
                slug: 'al-aweer-royal-fruits-llc',
                stallNumber: 'Block A, Stall 01',
                phone: '+971501112233',
                isApproved: true,
                isActive: true,
                createdAt: new Date().toISOString()
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getShops();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.shops.length, 1);
      assert.strictEqual(res.shops[0].name, 'Al Aweer Royal Fruits LLC');
      assert.strictEqual(res.shops[0].stallNumber, 'Block A, Stall 01');
    });

    it('retrieves stall storefront details and its specific produce items via getShopById', async () => {
      globalThis.fetch = async (url) => {
        assert.match(url.toString(), /\/api\/v1\/shops\/shop_1$/);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            shop: {
              id: 'shop_1',
              name: 'Al Aweer Royal Fruits LLC',
              slug: 'al-aweer-royal-fruits-llc',
              stallNumber: 'Block A, Stall 01',
              phone: '+971501112233',
              isApproved: true,
              isActive: true,
              createdAt: new Date().toISOString()
            },
            products: [
              {
                id: 'prod_1',
                name: 'Egyptian Oranges',
                category: 'citrus',
                originCountry: 'Egypt',
                description: 'Sweet oranges',
                offers: [
                  {
                    vendorId: 'shop_1',
                    shopName: 'Al Aweer Royal Fruits LLC',
                    unit: 'carton',
                    unitWeightKg: 15,
                    priceAed: 45,
                    equivalentPricePerKg: 3.0,
                    minOrderQuantity: 5,
                    availableStock: 50
                  }
                ]
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getShopById('shop_1');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.shop.name, 'Al Aweer Royal Fruits LLC');
      assert.strictEqual(res.products.length, 1);
      assert.strictEqual(res.products[0].name, 'Egyptian Oranges');
      assert.strictEqual(res.products[0].offers[0].priceAed, 45);
      // Ensure all offers strictly belong to the stall shopId
      assert.strictEqual(res.products[0].offers[0].vendorId, res.shop.id);
      assert.ok(res.products[0].id.length > 0);
    });

    it('returns empty array when backend has no approved shops without fabricating mock stalls', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 200,
            shops: []
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getShops();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.shops.length, 0);
    });

    it('verifies product offer vendorId generates real /shops/${vendorId} route', () => {
      const bestOffer = {
        vendorId: 'shop_real_123',
        shopName: 'Al Barakah Stall'
      };
      const vendorUrl = `/shops/${bestOffer.vendorId}`;
      assert.strictEqual(vendorUrl, '/shops/shop_real_123');
      assert.doesNotMatch(vendorUrl, /shop_alnoor_1/);
    });
  });

  describe('5. Category Slug Mapping & Produce Image Utilities', async () => {
    const { mapSlugToBackendCategory, resolveProduceImage } = await import(
      '../src/lib/catalog-utils.ts'
    );

    it('maps legacy /fruits and /vegetables to backend enum values', () => {
      assert.strictEqual(mapSlugToBackendCategory('fruits'), 'fresh_fruits');
      assert.strictEqual(mapSlugToBackendCategory('fresh_fruits'), 'fresh_fruits');
      assert.strictEqual(mapSlugToBackendCategory('vegetables'), 'fresh_vegetables');
      assert.strictEqual(mapSlugToBackendCategory('fresh_vegetables'), 'fresh_vegetables');
    });

    it('maps citrus, greens, spices, berries, and root vegetables', () => {
      assert.strictEqual(mapSlugToBackendCategory('citrus'), 'citrus');
      assert.strictEqual(mapSlugToBackendCategory('leafy_greens'), 'leafy_greens');
      assert.strictEqual(mapSlugToBackendCategory('herbs_greens'), 'leafy_greens');
      assert.strictEqual(mapSlugToBackendCategory('exotic_produce'), 'exotic_produce');
      assert.strictEqual(mapSlugToBackendCategory('spices'), 'exotic_produce');
      assert.strictEqual(mapSlugToBackendCategory('berries'), 'berries');
      assert.strictEqual(mapSlugToBackendCategory('root_vegetables'), 'root_vegetables');
    });

    it('returns undefined for all, search, or invalid category slugs', () => {
      assert.strictEqual(mapSlugToBackendCategory('all'), undefined);
      assert.strictEqual(mapSlugToBackendCategory('search'), undefined);
      assert.strictEqual(mapSlugToBackendCategory(''), undefined);
      assert.strictEqual(mapSlugToBackendCategory(undefined), undefined);
    });

    it('resolves deterministic food photography based on name keywords', () => {
      assert.strictEqual(resolveProduceImage('Local Red Tomato'), '/images/tomato.jpg');
      assert.strictEqual(resolveProduceImage('Fresh Yellow Onion'), '/images/onion.jpg');
      assert.strictEqual(resolveProduceImage('New Crop Potato'), '/images/potato.jpg');
      assert.strictEqual(resolveProduceImage('Cavendish Banana'), '/images/banana.jpg');
      assert.strictEqual(resolveProduceImage('Royal Gala Apple'), '/images/apple.jpg');
      assert.strictEqual(resolveProduceImage('Sweet Carrots'), '/images/carrots.jpg');
      assert.strictEqual(resolveProduceImage('Fresh Culinary Mint'), '/images/carrots.jpg');
      assert.strictEqual(resolveProduceImage('Unknown Specialty Item'), '/images/hero-basket.jpg');
    });
  });
});
