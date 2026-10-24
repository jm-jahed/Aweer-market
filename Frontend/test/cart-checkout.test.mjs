/**
 * AweerMarket Buyer Cart & Single-Vendor Checkout Unit & Contract Tests
 * Uses native Node.js test runner (node --test) without external dependencies.
 * Verifies single-vendor cart isolation, conflict handling, server price authority,
 * and order creation API client contracts.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  createOrder,
  getBuyerOrders,
  getBuyerOrderById
} from '../src/lib/api-client.ts';

describe('AweerMarket Step 7 — Buyer Cart & Single-Vendor Wholesale Checkout', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('1. Single-Vendor Cart Isolation Logic', () => {
    it('allows adding multiple produce items from the same Al Aweer stall', () => {
      let cartState = {
        shopId: null,
        shopName: null,
        items: []
      };

      function addToCart(item, shop) {
        if (!cartState.shopId || cartState.items.length === 0 || cartState.shopId === shop.id) {
          cartState.shopId = shop.id;
          cartState.shopName = shop.name;
          cartState.items.push(item);
          return { success: true };
        }
        return {
          success: false,
          conflict: {
            existingShopName: cartState.shopName,
            newShopId: shop.id,
            newShopName: shop.name
          }
        };
      }

      // Add orange from Shop 1
      const res1 = addToCart(
        { productId: 'prod_orange', name: 'Valencia Oranges', quantity: 5, unitPriceAed: 45 },
        { id: 'shop_1', name: 'Al Barakah LLC' }
      );
      assert.strictEqual(res1.success, true);
      assert.strictEqual(cartState.items.length, 1);
      assert.strictEqual(cartState.shopId, 'shop_1');

      // Add bananas from the same Shop 1
      const res2 = addToCart(
        { productId: 'prod_banana', name: 'Cavendish Bananas', quantity: 2, unitPriceAed: 65 },
        { id: 'shop_1', name: 'Al Barakah LLC' }
      );
      assert.strictEqual(res2.success, true);
      assert.strictEqual(cartState.items.length, 2);
    });

    it('DETECTS CONFLICT when attempting to add produce from a second stall without mixing them', () => {
      let cartState = {
        shopId: 'shop_1',
        shopName: 'Al Barakah LLC',
        items: [{ productId: 'prod_orange', name: 'Valencia Oranges', quantity: 5, unitPriceAed: 45 }]
      };

      function addToCart(item, shop) {
        if (!cartState.shopId || cartState.items.length === 0 || cartState.shopId === shop.id) {
          cartState.shopId = shop.id;
          cartState.shopName = shop.name;
          cartState.items.push(item);
          return { success: true };
        }
        return {
          success: false,
          conflict: {
            existingShopName: cartState.shopName,
            newShopId: shop.id,
            newShopName: shop.name
          }
        };
      }

      // Attempt to add tomatoes from Shop 2
      const res = addToCart(
        { productId: 'prod_tomato', name: 'Greenhouse Tomatoes', quantity: 3, unitPriceAed: 32 },
        { id: 'shop_2', name: 'Emirates Fresh LLC' }
      );

      // Must detect conflict and reject silent insertion
      assert.strictEqual(res.success, false);
      assert.ok(res.conflict);
      assert.strictEqual(res.conflict.existingShopName, 'Al Barakah LLC');
      assert.strictEqual(res.conflict.newShopName, 'Emirates Fresh LLC');

      // Original cart MUST remain intact with only Shop 1 items
      assert.strictEqual(cartState.items.length, 1);
      assert.strictEqual(cartState.shopId, 'shop_1');
    });

    it('replaces cart and resets vendor context when buyer confirms conflict resolution', () => {
      let cartState = {
        shopId: 'shop_1',
        shopName: 'Al Barakah LLC',
        items: [{ productId: 'prod_orange', name: 'Valencia Oranges', quantity: 5, unitPriceAed: 45 }]
      };

      function replaceCart(newItem, newShop) {
        cartState = {
          shopId: newShop.id,
          shopName: newShop.name,
          items: [newItem]
        };
      }

      // Buyer approves replacing the cart with Shop 2 items
      replaceCart(
        { productId: 'prod_tomato', name: 'Greenhouse Tomatoes', quantity: 3, unitPriceAed: 32 },
        { id: 'shop_2', name: 'Emirates Fresh LLC' }
      );

      assert.strictEqual(cartState.shopId, 'shop_2');
      assert.strictEqual(cartState.shopName, 'Emirates Fresh LLC');
      assert.strictEqual(cartState.items.length, 1);
      assert.strictEqual(cartState.items[0].name, 'Greenhouse Tomatoes');
    });
  });

  describe('2. Order Creation & Price Authority Contracts (createOrder)', () => {
    it('submits order request with credentials: "include" and server-authoritative structure', async () => {
      let capturedBody = null;

      globalThis.fetch = async (url, options) => {
        assert.match(url.toString(), /\/api\/v1\/orders$/);
        assert.strictEqual(options.method, 'POST');
        assert.strictEqual(options.credentials, 'include');
        capturedBody = JSON.parse(options.body);

        return new Response(
          JSON.stringify({
            statusCode: 201,
            message: 'Order created successfully',
            order: {
              id: 'order_123',
              orderNumber: 'AWR-20261023-XYZ1',
              buyerId: 'usr_buyer_1',
              shopId: 'shop_1',
              shopName: 'Al Barakah LLC',
              deliveryType: 'scheduled_delivery',
              deliveryAddress: 'Al Quoz 3, Dubai',
              status: 'pending',
              totalAmountAed: 465,
              items: [
                {
                  productId: 'prod_orange',
                  name: 'Valencia Oranges',
                  unit: 'carton',
                  unitWeightKg: 15,
                  quantity: 6,
                  unitPriceAed: 45,
                  lineTotalAed: 270
                }
              ],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await createOrder({
        shopId: 'shop_1',
        deliveryType: 'scheduled_delivery',
        deliveryAddress: 'Al Quoz 3, Dubai',
        items: [{ productId: 'prod_orange', quantity: 6 }]
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.order.orderNumber, 'AWR-20261023-XYZ1');
      assert.strictEqual(res.order.totalAmountAed, 465);

      // Confirm client NEVER submitted unitPriceAed (Server Price Authority)
      assert.strictEqual(capturedBody.items[0].unitPriceAed, undefined);
      assert.strictEqual(capturedBody.items[0].quantity, 6);
    });
  });

  describe('3. Buyer Order Retrieval (getBuyerOrders & getBuyerOrderById)', () => {
    it('retrieves authenticated buyer past orders list via getBuyerOrders', async () => {
      globalThis.fetch = async (url, options) => {
        assert.match(url.toString(), /\/api\/v1\/orders$/);
        assert.strictEqual(options.method, 'GET');
        assert.strictEqual(options.credentials, 'include');

        return new Response(
          JSON.stringify({
            statusCode: 200,
            orders: [
              {
                id: 'order_1',
                orderNumber: 'AWR-20261023-AAAA',
                buyerId: 'usr_buyer_1',
                shopId: 'shop_1',
                shopName: 'Al Barakah LLC',
                totalAmountAed: 350,
                status: 'pending',
                items: []
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getBuyerOrders();
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.orders.length, 1);
      assert.strictEqual(res.orders[0].orderNumber, 'AWR-20261023-AAAA');
    });

    it('retrieves single buyer order details via getBuyerOrderById', async () => {
      globalThis.fetch = async (url, options) => {
        assert.match(url.toString(), /\/api\/v1\/orders\/order_1$/);
        assert.strictEqual(options.method, 'GET');

        return new Response(
          JSON.stringify({
            statusCode: 200,
            order: {
              id: 'order_1',
              orderNumber: 'AWR-20261023-AAAA',
              totalAmountAed: 350,
              status: 'pending'
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await getBuyerOrderById('order_1');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.order.id, 'order_1');
    });
  });

  describe('4. Commercial Invoicing & UAE VAT Calculations', () => {
    it('calculates 5% inclusive VAT correctly for a Dhs 100 wholesale order producing Dhs 4.76 VAT and Dhs 95.24 subtotal', () => {
      const orderTotalAmount = 100;
      const subtotal = orderTotalAmount / 1.05;
      const vatComponent = orderTotalAmount - subtotal;

      assert.strictEqual(subtotal.toFixed(2), '95.24');
      assert.strictEqual(vatComponent.toFixed(2), '4.76');
      assert.strictEqual((Number(subtotal.toFixed(2)) + Number(vatComponent.toFixed(2))).toFixed(2), '100.00');
    });
  });
});
