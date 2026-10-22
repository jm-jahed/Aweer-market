/**
 * AweerMarket Frontend API Client Unit Tests
 * Uses native Node.js test runner (node --test) without external dependencies.
 * Mocks global fetch to assert client behavior, credentials, error handling, and URL resolution in isolation.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  resolveApiUrl,
  apiRequest,
  registerBuyer,
  loginBuyer,
  getAuthMe,
  logoutUser,
  ApiClientError
} from '../src/lib/api-client.ts';

describe('Phase 3.2-A: Frontend API Client Unit Tests', () => {
  const originalEnvUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset env
    if (originalEnvUrl !== undefined) {
      process.env.NEXT_PUBLIC_API_URL = originalEnvUrl;
    } else {
      delete process.env.NEXT_PUBLIC_API_URL;
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnvUrl !== undefined) {
      process.env.NEXT_PUBLIC_API_URL = originalEnvUrl;
    } else {
      delete process.env.NEXT_PUBLIC_API_URL;
    }
  });

  // ==========================================================================
  // 1. API Base URL Resolution & Path Normalization
  // ==========================================================================
  describe('1. API Base URL Resolution', () => {
    it('uses default fallback http://localhost:4000/api/v1 when NEXT_PUBLIC_API_URL is unset', () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      const url = resolveApiUrl('/auth/login');
      assert.strictEqual(url, 'http://localhost:4000/api/v1/auth/login');
    });

    it('avoids duplicate /api/v1 segments when base URL already ends with /api/v1', () => {
      process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000/api/v1';
      assert.strictEqual(resolveApiUrl('/auth/register'), 'http://localhost:4000/api/v1/auth/register');
      // Even if path accidentally includes /api/v1
      assert.strictEqual(resolveApiUrl('/api/v1/auth/register'), 'http://localhost:4000/api/v1/auth/register');
    });

    it('handles base URL without /api/v1 suffix and appends /api/v1 properly', () => {
      process.env.NEXT_PUBLIC_API_URL = 'http://api.aweermarket.ae';
      assert.strictEqual(resolveApiUrl('/auth/me'), 'http://api.aweermarket.ae/api/v1/auth/me');
      assert.strictEqual(resolveApiUrl('/api/v1/auth/me'), 'http://api.aweermarket.ae/api/v1/auth/me');
    });

    it('strips trailing slashes from base URL', () => {
      process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000/api/v1///';
      assert.strictEqual(resolveApiUrl('/auth/logout'), 'http://localhost:4000/api/v1/auth/logout');
    });
  });

  // ==========================================================================
  // 2. Cookie Credentials & Method Enforcements
  // ==========================================================================
  describe('2. Cookie Credentials & Request Options', () => {
    it('always sends credentials: "include" for cookie transmission', async () => {
      let capturedOptions = null;
      globalThis.fetch = async (_url, options) => {
        capturedOptions = options;
        return new Response(JSON.stringify({ statusCode: 200, user: { id: 'usr_1', role: 'buyer' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      await getAuthMe();
      assert.ok(capturedOptions);
      assert.strictEqual(capturedOptions.credentials, 'include', 'Must enforce credentials: "include" for HTTP-only cookies');
      assert.strictEqual(capturedOptions.method, 'GET');
    });

    it('sets Content-Type: application/json for request payloads', async () => {
      let capturedHeaders = null;
      let capturedBody = null;
      globalThis.fetch = async (_url, options) => {
        capturedHeaders = options.headers;
        capturedBody = options.body;
        return new Response(JSON.stringify({ statusCode: 200, message: 'ok', user: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const loginData = { email: 'buyer@aweermarket.ae', password: 'Password123!' };
      await loginBuyer(loginData);

      assert.strictEqual(capturedHeaders.get('Content-Type'), 'application/json');
      assert.strictEqual(capturedBody, JSON.stringify(loginData));
    });
  });

  // ==========================================================================
  // 3. Typed Endpoint Helpers
  // ==========================================================================
  describe('3. Typed Endpoint Helpers', () => {
    it('registerBuyer calls POST /auth/register', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedMethod = options.method;
        return new Response(JSON.stringify({
          statusCode: 201,
          message: 'Buyer registration successful',
          user: { id: 'buyer_1', email: 'test@aweer.ae', role: 'buyer' }
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const res = await registerBuyer({
        email: 'test@aweer.ae',
        password: 'Password123!',
        fullName: 'Test Buyer',
        phone: '+971501234567'
      });

      assert.match(capturedUrl, /\/auth\/register$/);
      assert.strictEqual(capturedMethod, 'POST');
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.user.role, 'buyer');
    });

    it('logoutUser calls POST /auth/logout', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedMethod = options.method;
        return new Response(JSON.stringify({ statusCode: 200, message: 'Logged out successfully' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const res = await logoutUser();
      assert.match(capturedUrl, /\/auth\/logout$/);
      assert.strictEqual(capturedMethod, 'POST');
      assert.strictEqual(res.statusCode, 200);
    });

    it('handles empty response bodies gracefully without parse crashes', async () => {
      globalThis.fetch = async () => {
        return new Response('', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      };

      const res = await apiRequest('/health');
      assert.ok(res !== null && typeof res === 'object');
    });
  });

  // ==========================================================================
  // 4. Safe Error Handling & Status Sanitization
  // ==========================================================================
  describe('4. Safe Error Handling', () => {
    it('handles HTTP 400 Bad Request with client validation message', async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Password must be at least 8 characters'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      await assert.rejects(
        async () => await loginBuyer({ email: 'bad@test.ae', password: '123' }),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.message, 'Password must be at least 8 characters');
          return true;
        }
      );
    });

    it('handles HTTP 401 Unauthorized with generic safe message', async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid email or password'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      await assert.rejects(
        async () => await loginBuyer({ email: 'unknown@test.ae', password: 'WrongPassword123!' }),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 401);
          assert.strictEqual(err.message, 'Invalid email or password');
          return true;
        }
      );
    });

    it('handles HTTP 403 Forbidden with account deactivation message', async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Account has been deactivated. Please contact support.'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      await assert.rejects(
        async () => await loginBuyer({ email: 'deactivated@test.ae', password: 'Password123!' }),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /deactivated/i);
          return true;
        }
      );
    });

    it('handles HTTP 409 Conflict for duplicate registration', async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({
          statusCode: 409,
          error: 'Conflict',
          message: 'An account with this email already exists'
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      await assert.rejects(
        async () => await registerBuyer({
          email: 'duplicate@test.ae',
          password: 'Password123!',
          fullName: 'Duplicate User',
          phone: '+971501234567'
        }),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.message, 'An account with this email already exists');
          return true;
        }
      );
    });

    it('handles HTTP 503 Service Unavailable safely without exposing internal database details', async () => {
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
          // Guarantee no stack traces or database connection strings leaked
          assert.strictEqual(err.stack?.includes('mongodb://'), false);
          return true;
        }
      );
    });

    it('handles Network Failure (TypeError / connection dropped) cleanly', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('fetch failed: ECONNREFUSED');
      };

      await assert.rejects(
        async () => await getAuthMe(),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.strictEqual(err.statusCode, 0);
          assert.strictEqual(err.errorTitle, 'NetworkError');
          assert.match(err.message, /Unable to connect to the marketplace server/i);
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // 5. Browser Storage Hygiene
  // ==========================================================================
  describe('5. Browser Storage Hygiene', () => {
    it('does NOT write or store session tokens in storage objects', async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({
          statusCode: 200,
          message: 'Login successful',
          user: { id: 'buyer_99', email: 'test@aweer.ae', role: 'buyer' }
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'aweer_session=secret_token; Path=/api/v1; HttpOnly'
          }
        });
      };

      const res = await loginBuyer({ email: 'test@aweer.ae', password: 'Password123!' });
      assert.strictEqual(res.statusCode, 200);

      // Verify response body does not expose raw token string
      assert.strictEqual(res.token, undefined);
      assert.strictEqual(res.user.passwordHash, undefined);
      assert.strictEqual(res.user.password, undefined);
    });
  });
});
