/**
 * AweerMarket Frontend Session Restoration & Logout Unit Tests
 * Uses native Node.js test runner (node --test) without external dependencies.
 * Tests session restoration from /api/v1/auth/me, logout execution, error isolation, and state transitions.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { getAuthMe, logoutUser, ApiClientError } from '../src/lib/api-client.ts';

describe('Phase 3.2-C: Session Restoration & Logout Unit Tests', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ==========================================================================
  // 1. Session Restoration (GET /auth/me) Contract Assertions
  // ==========================================================================
  describe('1. Session Restoration (GET /auth/me)', () => {
    const mockBuyerUser = {
      id: 'buyer_usr_12345',
      email: 'buyer@aweermarket.ae',
      fullName: 'Fatima Al Mansoori',
      role: 'buyer',
      businessName: 'Fresh Oasis Restaurant LLC',
      isActive: true,
      isEmailVerified: false,
      createdAt: '2026-10-22T20:00:00.000Z'
    };

    it('successfully restores authenticated session when cookie is valid (HTTP 200)', async () => {
      let capturedUrl = '';
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return new Response(JSON.stringify({ statusCode: 200, user: mockBuyerUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const response = await getAuthMe();
      assert.match(capturedUrl, /\/auth\/me$/);
      assert.strictEqual(capturedOptions.method, 'GET');
      assert.strictEqual(capturedOptions.credentials, 'include', 'Must include credentials for cookie transmission');
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.user.id, 'buyer_usr_12345');
      assert.strictEqual(response.user.email, 'buyer@aweermarket.ae');
      assert.strictEqual(response.user.role, 'buyer');
    });

    it('rejects with ApiClientError (401) when no cookie or expired cookie is present', async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication token is required'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      await assert.rejects(
        async () => await getAuthMe(),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 401);
          assert.strictEqual(err.message, 'Authentication token is required');
          return true;
        }
      );
    });

    it('rejects with ApiClientError (403) when user account has been deactivated', async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Account has been deactivated'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      await assert.rejects(
        async () => await getAuthMe(),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /deactivated/i);
          return true;
        }
      );
    });

    it('rejects with ApiClientError (503) when database is offline in fail-closed mode', async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Service temporarily unavailable. Please try again later.'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      await assert.rejects(
        async () => await getAuthMe(),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 503);
          assert.strictEqual(err.errorTitle, 'Service Unavailable');
          assert.strictEqual(err.message, 'Service temporarily unavailable. Please try again later.');
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // 2. Logout Flow (POST /auth/logout)
  // ==========================================================================
  describe('2. Logout Flow (POST /auth/logout)', () => {
    it('calls POST /auth/logout with credentials: "include" to clear session cookie', async () => {
      let capturedUrl = '';
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return new Response(JSON.stringify({
          statusCode: 200,
          message: 'Logged out successfully'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'aweer_session=; Path=/api/v1; Max-Age=0; HttpOnly'
          }
        });
      };

      const response = await logoutUser();
      assert.match(capturedUrl, /\/auth\/logout$/);
      assert.strictEqual(capturedOptions.method, 'POST');
      assert.strictEqual(capturedOptions.credentials, 'include');
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.message, 'Logged out successfully');
    });

    it('surfaces network errors on logout as ApiClientError without unhandled crashes', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch: Network is down');
      };

      await assert.rejects(
        async () => await logoutUser(),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 0);
          assert.strictEqual(err.errorTitle, 'NetworkError');
          assert.match(err.message, /Unable to connect/i);
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // 3. In-Memory Session State Hygiene
  // ==========================================================================
  describe('3. In-Memory State & Storage Hygiene', () => {
    it('restoration response strictly adheres to safe UserSummary (no tokens, no password hashes)', async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({
          statusCode: 200,
          user: {
            id: 'buyer_1',
            email: 'buyer@aweer.ae',
            fullName: 'Safe Buyer',
            role: 'buyer',
            isActive: true,
            isEmailVerified: true,
            createdAt: '2026-10-22T00:00:00.000Z'
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const res = await getAuthMe();
      assert.strictEqual(res.user.role, 'buyer');
      assert.strictEqual(res.user.passwordHash, undefined);
      assert.strictEqual(res.user.password, undefined);
      assert.strictEqual(res.token, undefined);
    });
  });
});
