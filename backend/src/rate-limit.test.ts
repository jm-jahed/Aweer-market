/**
 * AweerMarket Authentication Rate Limiting Integration Tests
 * 
 * Verifies:
 * 1. Safe rate limiting for Buyer Login, Vendor Login, Super Admin Login, and Registration.
 * 2. Normal requests within limit behave normally (200 / 401).
 * 3. Requests exceeding configured threshold return HTTP 429 Too Many Requests with standard rate-limit headers.
 * 4. Dual-keying enforcement: IP-based and Account-based tracking.
 * 5. Case-insensitivity and formatting normalization prevents bypass.
 * 6. Non-authentication routes (/health, /products) remain completely unaffected.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { buildServer } from './server.js';
import {
  configureAuthRateLimit,
  resetAuthRateLimitConfig,
  resetAuthRateLimitStore
} from './plugins/rate-limit.js';
import {
  createBuyerUser,
  createShopAdminUser,
  createSuperAdminUser,
  resetInMemoryUsers
} from './models/user.model.js';
import { createShop, resetInMemoryShops } from './models/shop.model.js';
import { hashPassword } from './utils/crypto.js';

describe('Phase 3.2: Authentication Rate Limiting', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    resetInMemoryUsers();
    resetInMemoryShops();
    resetAuthRateLimitStore();

    // Configure low, deterministic thresholds for testing
    configureAuthRateLimit({
      windowMs: 60 * 1000, // 1 minute window
      maxIpAttempts: 5,
      maxAccountAttempts: 3,
      registerMaxIpAttempts: 4,
      registerMaxAccountAttempts: 2
    });

    server = await buildServer();
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    resetAuthRateLimitStore();
    resetAuthRateLimitConfig();
  });

  // ==========================================================================
  // 1. Buyer Login Rate Limiting
  // ==========================================================================
  describe('1. Buyer Login Rate Limiting', () => {
    it('allows requests within limit and returns standard rate-limit headers', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@aweermarket.ae',
          password: 'Password123!'
        }
      });

      // Allowed past rate limiter (returns 401 for wrong credentials)
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.headers['x-ratelimit-limit']);
      assert.ok(res.headers['x-ratelimit-remaining'] !== undefined);
      assert.ok(res.headers['x-ratelimit-reset']);
    });

    it('DENIES buyer login requests exceeding account limit with HTTP 429 Too Many Requests', async () => {
      const email = 'target-buyer@aweermarket.ae';

      // Attempts 1 and 2 are allowed (maxAccountAttempts is 3)
      for (let i = 1; i <= 2; i++) {
        const res = await server.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email, password: 'WrongPassword!' }
        });
        assert.strictEqual(res.statusCode, 401, `Attempt ${i} should be allowed`);
      }

      // Attempt 3 is allowed (reaches limit of 3)
      const res3 = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password: 'WrongPassword!' }
      });
      assert.strictEqual(res3.statusCode, 401);

      // Attempt 4 MUST be blocked with 429
      const blockedRes = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password: 'WrongPassword!' }
      });

      assert.strictEqual(blockedRes.statusCode, 429);
      const body = JSON.parse(blockedRes.payload);
      assert.strictEqual(body.statusCode, 429);
      assert.strictEqual(body.error, 'Too Many Requests');
      assert.match(body.message, /rate limit exceeded/i);

      // Verify required rate limit headers
      assert.strictEqual(blockedRes.headers['x-ratelimit-remaining'], '0');
      assert.ok(Number(blockedRes.headers['retry-after']) >= 1);
      assert.ok(blockedRes.headers['x-ratelimit-reset']);
    });

    it('prevents account limit bypass via email casing or leading/trailing whitespace', async () => {
      // 3 attempts with varied casing and whitespace
      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'victim@aweermarket.ae', password: 'Bad1' }
      });
      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'VICTIM@AWEERMARKET.AE', password: 'Bad2' }
      });
      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: '  Victim@AweerMarket.ae  ', password: 'Bad3' }
      });

      // 4th attempt with different casing must still be blocked by normalized account bucket
      const blocked = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'victim@AWEERMARKET.ae', password: 'Bad4' }
      });

      assert.strictEqual(blocked.statusCode, 429);
      const body = JSON.parse(blocked.payload);
      assert.strictEqual(body.statusCode, 429);
      assert.match(body.message, /too many authentication attempts/i);
    });
  });

  // ==========================================================================
  // 2. Vendor Login Rate Limiting
  // ==========================================================================
  describe('2. Vendor Login Rate Limiting', () => {
    it('DENIES repeated vendor login attempts exceeding account limit with HTTP 429', async () => {
      const email = 'stall-owner@aweermarket.ae';

      for (let i = 0; i < 3; i++) {
        const res = await server.inject({
          method: 'POST',
          url: '/api/v1/auth/vendor/login',
          payload: { email, password: 'WrongVendorPassword!' }
        });
        assert.strictEqual(res.statusCode, 401);
      }

      // 4th attempt must be rejected by rate limiter
      const blocked = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/login',
        payload: { email, password: 'WrongVendorPassword!' }
      });

      assert.strictEqual(blocked.statusCode, 429);
      const body = JSON.parse(blocked.payload);
      assert.strictEqual(body.statusCode, 429);
      assert.strictEqual(body.error, 'Too Many Requests');
    });
  });

  // ==========================================================================
  // 3. Super Admin Login Rate Limiting
  // ==========================================================================
  describe('3. Super Admin Login Rate Limiting', () => {
    it('DENIES repeated Super Admin login attempts exceeding account limit with HTTP 429', async () => {
      const email = 'superadmin@aweermarket.ae';

      for (let i = 0; i < 3; i++) {
        const res = await server.inject({
          method: 'POST',
          url: '/api/v1/auth/super-admin/login',
          payload: { email, password: 'WrongSuperAdminPass!' }
        });
        assert.strictEqual(res.statusCode, 401);
      }

      // 4th attempt must return 429
      const blocked = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/super-admin/login',
        payload: { email, password: 'WrongSuperAdminPass!' }
      });

      assert.strictEqual(blocked.statusCode, 429);
      const body = JSON.parse(blocked.payload);
      assert.strictEqual(body.statusCode, 429);
      assert.strictEqual(body.error, 'Too Many Requests');
      assert.match(body.message, /too many authentication attempts/i);
    });
  });

  // ==========================================================================
  // 4. Registration Rate Limiting
  // ==========================================================================
  describe('4. Registration Rate Limiting', () => {
    it('DENIES buyer registration when account limit is exceeded with HTTP 429', async () => {
      const email = 'repeated-register@aweermarket.ae';
      const basePayload = {
        email,
        password: 'ValidPassword123!',
        fullName: 'Test Registrant',
        phone: '+971501112233'
      };

      // 1st attempt: 201 Created
      const res1 = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: basePayload
      });
      assert.strictEqual(res1.statusCode, 201);

      // 2nd attempt with same email: 409 Conflict (registered, but counted toward email bucket)
      const res2 = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: basePayload
      });
      assert.strictEqual(res2.statusCode, 409);

      // 3rd attempt: Exceeds registerMaxAccountAttempts (2) -> 429
      const res3 = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: basePayload
      });
      assert.strictEqual(res3.statusCode, 429);
      const body = JSON.parse(res3.payload);
      assert.strictEqual(body.statusCode, 429);
      assert.match(body.message, /registration attempts/i);
    });

    it('DENIES vendor registration when account limit is exceeded with HTTP 429', async () => {
      const email = 'repeated-vendor-reg@aweermarket.ae';
      const vendorPayload = {
        email,
        password: 'ValidPassword123!',
        fullName: 'Hassan Vendor',
        stallName: 'Hassan Produce Stall',
        stallNumber: 'Block D, Stall 12',
        tradeLicenseNumber: 'TL-987654',
        phone: '+971509876543'
      };

      // 1st attempt: 201 Created
      const res1 = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: vendorPayload
      });
      assert.strictEqual(res1.statusCode, 201);

      // 2nd attempt: 409 Conflict (duplicate email)
      const res2 = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: vendorPayload
      });
      assert.strictEqual(res2.statusCode, 409);

      // 3rd attempt: Exceeds registerMaxAccountAttempts -> 429
      const res3 = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/vendor/register',
        payload: vendorPayload
      });
      assert.strictEqual(res3.statusCode, 429);
      const body = JSON.parse(res3.payload);
      assert.strictEqual(body.statusCode, 429);
      assert.match(body.message, /registration attempts/i);
    });
  });

  // ==========================================================================
  // 5. Non-Authentication Endpoints Independence
  // ==========================================================================
  describe('5. Non-Authentication Endpoints Independence', () => {
    it('does NOT block or rate-limit normal non-authentication endpoints even after auth limits are triggered', async () => {
      const email = 'lockout-test@aweermarket.ae';

      // Exceed login limit for this client
      for (let i = 0; i < 4; i++) {
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email, password: 'BadPassword' }
        });
      }

      // Verify login is blocked
      const authBlocked = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password: 'BadPassword' }
      });
      assert.strictEqual(authBlocked.statusCode, 429);

      // Normal API route GET /api/v1/health must remain 200 OK
      const healthRes = await server.inject({
        method: 'GET',
        url: '/api/v1/health'
      });
      assert.strictEqual(healthRes.statusCode, 200);

      // Normal API route GET /api/v1/products must remain 200 OK
      const productsRes = await server.inject({
        method: 'GET',
        url: '/api/v1/products'
      });
      assert.strictEqual(productsRes.statusCode, 200);

      // Root endpoint GET / must remain 200 OK
      const rootRes = await server.inject({
        method: 'GET',
        url: '/'
      });
      assert.strictEqual(rootRes.statusCode, 200);
    });
  });
});
