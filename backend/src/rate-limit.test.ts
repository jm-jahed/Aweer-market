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
import { buildServer, parseTrustProxyConfig } from './server.js';
import {
  configureAuthRateLimit,
  resetAuthRateLimitConfig,
  resetAuthRateLimitStore,
  parsePositiveIntegerEnv
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

  // ==========================================================================
  // 7. TRUST_PROXY Configuration & Forwarded Header Security Tests
  // ==========================================================================
  describe('7. TRUST_PROXY Configuration & Forwarded Header Security', () => {
    describe('7.1 parseTrustProxyConfig Unit Validation', () => {
      it('defaults to false when unset, null, false, empty, or whitespace', () => {
        assert.strictEqual(parseTrustProxyConfig(undefined), false);
        assert.strictEqual(parseTrustProxyConfig(null as any), false);
        assert.strictEqual(parseTrustProxyConfig(false), false);
        assert.strictEqual(parseTrustProxyConfig(''), false);
        assert.strictEqual(parseTrustProxyConfig('   '), false);
        assert.strictEqual(parseTrustProxyConfig('false'), false);
        assert.strictEqual(parseTrustProxyConfig('0'), false);
      });

      it('returns true on explicit boolean true or "true" / "1"', () => {
        assert.strictEqual(parseTrustProxyConfig(true), true);
        assert.strictEqual(parseTrustProxyConfig('true'), true);
        assert.strictEqual(parseTrustProxyConfig('1'), true);
      });

      it('accepts valid IP addresses, supported aliases, and CIDRs', () => {
        assert.strictEqual(parseTrustProxyConfig('127.0.0.1'), '127.0.0.1');
        assert.strictEqual(parseTrustProxyConfig('::1'), '::1');
        assert.strictEqual(parseTrustProxyConfig('loopback'), 'loopback');
        assert.strictEqual(parseTrustProxyConfig('linklocal'), 'linklocal');
        assert.strictEqual(parseTrustProxyConfig('uniquelocal'), 'uniquelocal');
        assert.strictEqual(parseTrustProxyConfig('10.0.0.0/8'), '10.0.0.0/8');
        assert.strictEqual(parseTrustProxyConfig('172.16.0.0/12'), '172.16.0.0/12');
        assert.strictEqual(parseTrustProxyConfig('192.168.0.0/16'), '192.168.0.0/16');
        assert.strictEqual(parseTrustProxyConfig('fd00::/8'), 'fd00::/8');
        assert.deepStrictEqual(parseTrustProxyConfig('127.0.0.1, ::1'), ['127.0.0.1', '::1']);
        assert.deepStrictEqual(parseTrustProxyConfig(['127.0.0.1', '10.0.0.0/8']), ['127.0.0.1', '10.0.0.0/8']);
      });

      it('rejects malformed IP addresses and unsupported strings with fail-closed error', () => {
        assert.throws(
          () => parseTrustProxyConfig('invalid_ip'),
          /Security Configuration Error: Invalid TRUST_PROXY entry 'invalid_ip'/
        );
        assert.throws(
          () => parseTrustProxyConfig('999.999.999.999'),
          /Security Configuration Error: Invalid TRUST_PROXY entry '999.999.999.999'/
        );
        assert.throws(
          () => parseTrustProxyConfig('127.0.0.1;10.0.0.1'),
          /Security Configuration Error: Invalid TRUST_PROXY entry '127.0.0.1;10.0.0.1'/
        );
      });

      it('rejects invalid CIDR masks with fail-closed error', () => {
        assert.throws(
          () => parseTrustProxyConfig('10.0.0.1/35'),
          /IPv4 CIDR mask must be between 0 and 32/
        );
        assert.throws(
          () => parseTrustProxyConfig('::1/130'),
          /IPv6 CIDR mask must be between 0 and 128/
        );
        assert.throws(
          () => parseTrustProxyConfig('10.0.0.1/abc'),
          /Mask 'abc' must be an integer/
        );
      });
    });

    describe('7.2 Forwarded Header Trust & Isolation in Fastify', () => {
      it('ignores X-Forwarded-For by default when proxy trust is disabled', async () => {
        const defaultServer = await buildServer({ trustProxy: false });
        await defaultServer.ready();
        try {
          const res = await defaultServer.inject({
            method: 'GET',
            url: '/api/v1/health',
            headers: {
              'x-forwarded-for': '203.0.113.195'
            }
          });
          assert.strictEqual(res.statusCode, 200);
        } finally {
          await defaultServer.close();
        }
      });

      it('resolves real client IP when request arrives from configured trusted proxy', async () => {
        const trustedServer = await buildServer({ trustProxy: '127.0.0.1' });
        await trustedServer.ready();
        try {
          configureAuthRateLimit({
            windowMs: 60 * 1000,
            maxIpAttempts: 2
          });

          const clientIp = '203.0.113.88';

          // 1st request through trusted loopback proxy: allowed past IP limiter (401)
          const res1 = await trustedServer.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            remoteAddress: '127.0.0.1',
            headers: { 'x-forwarded-for': clientIp },
            payload: { email: 'test1@aweer.ae', password: 'WrongPassword123!' }
          });
          assert.strictEqual(res1.statusCode, 401);

          // 2nd request through trusted loopback proxy: allowed past IP limiter (401)
          const res2 = await trustedServer.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            remoteAddress: '127.0.0.1',
            headers: { 'x-forwarded-for': clientIp },
            payload: { email: 'test2@aweer.ae', password: 'WrongPassword123!' }
          });
          assert.strictEqual(res2.statusCode, 401);

          // 3rd request from same client IP exceeds maxIpAttempts (2): blocked with HTTP 429
          const res3 = await trustedServer.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            remoteAddress: '127.0.0.1',
            headers: { 'x-forwarded-for': clientIp },
            payload: { email: 'test3@aweer.ae', password: 'WrongPassword123!' }
          });
          assert.strictEqual(res3.statusCode, 429);
          assert.strictEqual(res3.headers['x-ratelimit-remaining'], '0');
          assert.ok(res3.headers['retry-after']);
          assert.match(res3.json().message, /rate limit exceeded/i);
        } finally {
          await trustedServer.close();
        }
      });

      it('rejects forwarded headers from untrusted socket sources (anti-spoofing)', async () => {
        // Only trust 10.0.0.1 as proxy; socket 192.168.1.50 is untrusted
        const proxyServer = await buildServer({ trustProxy: '10.0.0.1' });
        await proxyServer.ready();
        try {
          configureAuthRateLimit({
            windowMs: 60 * 1000,
            maxIpAttempts: 2
          });

          // Attacker attempts to spoof various client IPs from untrusted socket 192.168.1.50
          const res1 = await proxyServer.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            remoteAddress: '192.168.1.50',
            headers: { 'x-forwarded-for': '8.8.8.8' },
            payload: { email: 'victim1@aweer.ae', password: 'WrongPassword123!' }
          });
          assert.strictEqual(res1.statusCode, 401);

          // Attacker sends different spoofed header; because socket is untrusted,
          // Fastify attributes both to socket IP 192.168.1.50!
          const res2 = await proxyServer.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            remoteAddress: '192.168.1.50',
            headers: { 'x-forwarded-for': '9.9.9.9' },
            payload: { email: 'victim2@aweer.ae', password: 'WrongPassword123!' }
          });
          assert.strictEqual(res2.statusCode, 401);

          // 3rd attempt from untrusted socket is blocked despite changing X-Forwarded-For (spoofing failed)
          const res3 = await proxyServer.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            remoteAddress: '192.168.1.50',
            headers: { 'x-forwarded-for': '1.1.1.1' },
            payload: { email: 'victim3@aweer.ae', password: 'WrongPassword123!' }
          });
          assert.strictEqual(res3.statusCode, 429);
          assert.strictEqual(res3.headers['x-ratelimit-remaining'], '0');
        } finally {
          await proxyServer.close();
        }
      });

      it('isolates different clients behind the same trusted proxy without collateral blocking', async () => {
        const trustedServer = await buildServer({ trustProxy: '127.0.0.1' });
        await trustedServer.ready();
        try {
          configureAuthRateLimit({
            windowMs: 60 * 1000,
            maxIpAttempts: 2
          });

          const clientA = '203.0.113.10';
          const clientB = '203.0.113.20';

          // Client A uses up all their 2 attempts through the trusted proxy
          for (let i = 0; i < 2; i++) {
            const res = await trustedServer.inject({
              method: 'POST',
              url: '/api/v1/auth/login',
              remoteAddress: '127.0.0.1',
              headers: { 'x-forwarded-for': clientA },
              payload: { email: `clientA_${i}@aweer.ae`, password: 'WrongPassword123!' }
            });
            assert.strictEqual(res.statusCode, 401);
          }

          // Client A attempt 3 is blocked (429)
          const blockedA = await trustedServer.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            remoteAddress: '127.0.0.1',
            headers: { 'x-forwarded-for': clientA },
            payload: { email: 'clientA_3@aweer.ae', password: 'WrongPassword123!' }
          });
          assert.strictEqual(blockedA.statusCode, 429);

          // Client B through the SAME proxy is NOT blocked!
          const allowedB = await trustedServer.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            remoteAddress: '127.0.0.1',
            headers: { 'x-forwarded-for': clientB },
            payload: { email: 'clientB_1@aweer.ae', password: 'WrongPassword123!' }
          });
          assert.strictEqual(allowedB.statusCode, 401); // Allowed past rate limiter
        } finally {
          await trustedServer.close();
        }
      });
    });

    describe('7.3 parsePositiveIntegerEnv Unit Validation', () => {
      it('returns parsed integer for valid positive integer strings', () => {
        assert.strictEqual(parsePositiveIntegerEnv('20', 10), 20);
        assert.strictEqual(parsePositiveIntegerEnv('100', 10), 100);
        assert.strictEqual(parsePositiveIntegerEnv('  60000  ', 10), 60000);
        assert.strictEqual(parsePositiveIntegerEnv('1', 10), 1);
      });

      it('safely falls back for non-numbers, negative, zero, floats, and empty strings', () => {
        assert.strictEqual(parsePositiveIntegerEnv(undefined, 42), 42);
        assert.strictEqual(parsePositiveIntegerEnv('', 42), 42);
        assert.strictEqual(parsePositiveIntegerEnv('   ', 42), 42);
        assert.strictEqual(parsePositiveIntegerEnv('0', 42), 42);
        assert.strictEqual(parsePositiveIntegerEnv('-10', 42), 42);
        assert.strictEqual(parsePositiveIntegerEnv('abc', 42), 42);
        assert.strictEqual(parsePositiveIntegerEnv('12.34', 42), 42);
        assert.strictEqual(parsePositiveIntegerEnv('NaN', 42), 42);
      });
    });
  });
});
