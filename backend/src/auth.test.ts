import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { UserRole } from '@aweermarket/types';
import { buildServer } from './server.js';
import {
  resetInMemoryUsers,
  findUserByEmail,
  setUserActiveStatus
} from './models/user.model.js';
import { signSessionToken } from './utils/crypto.js';
import { getSecretForRole } from './plugins/security.js';

const TEST_SECRET = 'test_buyer_secret_minimum_32_characters_long_ok!';
const TEST_SHOP_SECRET = 'test_shopadmin_secret_minimum_32_characters_ok!';
const TEST_SUPER_SECRET = 'test_superadmin_secret_minimum_32_characters_ok!';

describe('Phase 3.1: Backend Buyer Authentication Endpoints', () => {
  beforeEach(() => {
    // Isolate test database state
    resetInMemoryUsers();
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.ADMIN_JWT_SECRET = TEST_SHOP_SECRET;
    process.env.SUPER_ADMIN_JWT_SECRET = TEST_SUPER_SECRET;
  });

  const validBuyerPayload = {
    email: 'buyer@aweermarket.ae',
    password: 'SecurePassword123!',
    fullName: 'Fatima Al Mansoori',
    phone: '+971501234567',
    businessName: 'Fresh Oasis Restaurant LLC'
  };

  it('1. Registration succeeds with HTTP 201', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });

    assert.strictEqual(response.statusCode, 201);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.statusCode, 201);
    assert.strictEqual(body.message, 'Buyer registration successful');
    assert.ok(body.user);
    await server.close();
  });

  it('2. The resulting account is assigned BUYER by the server', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });

    assert.strictEqual(response.statusCode, 201);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.user.role, UserRole.BUYER);

    // Verify stored entity role directly
    const storedUser = await findUserByEmail(validBuyerPayload.email);
    assert.strictEqual(storedUser?.role, UserRole.BUYER);
    await server.close();
  });

  it('3. Registration response contains a safe user summary only (no passwordHash or secrets)', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });

    const body = JSON.parse(response.payload);
    assert.strictEqual(body.user.email, 'buyer@aweermarket.ae');
    assert.strictEqual(body.user.fullName, 'Fatima Al Mansoori');
    assert.strictEqual(body.user.passwordHash, undefined);
    assert.strictEqual(body.user.password, undefined);
    assert.strictEqual(body.token, undefined, 'Session token must not be exposed in JSON body');
    await server.close();
  });

  it('4. Duplicate email returns HTTP 409', async () => {
    const server = await buildServer();
    // Register first time
    const res1 = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });
    assert.strictEqual(res1.statusCode, 201);

    // Attempt register with same email
    const res2 = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        ...validBuyerPayload,
        fullName: 'Another Name'
      }
    });
    assert.strictEqual(res2.statusCode, 409);
    const body = JSON.parse(res2.payload);
    assert.strictEqual(body.error, 'Conflict');
    assert.match(body.message, /already exists/i);
    await server.close();
  });

  it('5. Privileged field injection is rejected (role, shopId)', async () => {
    const server = await buildServer();
    const maliciousPayload = {
      ...validBuyerPayload,
      role: 'super_admin', // Privileged escalation attempt
      shopId: 'stall_101'
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: maliciousPayload
    });

    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.error, 'Bad Request');
    assert.match(body.message, /unrecognized key/i);
    await server.close();
  });

  it('6. Oversized password (>128 chars) is rejected by validation', async () => {
    const server = await buildServer();
    const oversizedPayload = {
      ...validBuyerPayload,
      password: 'A'.repeat(129)
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: oversizedPayload
    });

    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.match(body.message, /cannot exceed 128 characters/i);
    await server.close();
  });

  it('7. Password is stored as a hash, not plaintext', async () => {
    const server = await buildServer();
    await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });

    const storedUser = await findUserByEmail(validBuyerPayload.email, true);
    assert.ok(storedUser);
    assert.notStrictEqual(storedUser.passwordHash, validBuyerPayload.password);
    assert.ok(storedUser.passwordHash.startsWith('scrypt$'), 'Stored password must be scrypt hash format');
    await server.close();
  });

  it('8. Login with correct credentials succeeds', async () => {
    const server = await buildServer();
    // Register
    await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });

    // Login
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: validBuyerPayload.email,
        password: validBuyerPayload.password
      }
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.message, 'Login successful');
    assert.strictEqual(body.user.email, validBuyerPayload.email);
    await server.close();
  });

  it('9. Login establishes the approved HTTP-only cookie', async () => {
    const server = await buildServer();
    await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: validBuyerPayload.email,
        password: validBuyerPayload.password
      }
    });

    const setCookieHeader = response.headers['set-cookie'] as string;
    assert.ok(setCookieHeader, 'Set-Cookie header must be present');
    assert.match(setCookieHeader, /aweer_session=/);
    assert.match(setCookieHeader, /HttpOnly/i);
    assert.match(setCookieHeader, /SameSite=Lax/i);
    assert.match(setCookieHeader, /Path=\/api\/v1/);
    await server.close();
  });

  it('10. Login JSON does not contain the session token', async () => {
    const server = await buildServer();
    await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: validBuyerPayload.email,
        password: validBuyerPayload.password
      }
    });

    const body = JSON.parse(response.payload);
    assert.strictEqual(body.token, undefined);
    assert.strictEqual(body.accessToken, undefined);
    assert.strictEqual(body.sessionToken, undefined);
    await server.close();
  });

  it('11. Invalid credentials return generic HTTP 401', async () => {
    const server = await buildServer();
    await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });

    // Wrong password
    const wrongPassRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: validBuyerPayload.email,
        password: 'WrongPassword999!'
      }
    });
    assert.strictEqual(wrongPassRes.statusCode, 401);
    const body1 = JSON.parse(wrongPassRes.payload);
    assert.strictEqual(body1.message, 'Invalid email or password');

    // Non-existent email
    const nonExistentRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'nobody@nowhere.com',
        password: 'ValidPassword123!'
      }
    });
    assert.strictEqual(nonExistentRes.statusCode, 401);
    const body2 = JSON.parse(nonExistentRes.payload);
    assert.strictEqual(body2.message, 'Invalid email or password');
    await server.close();
  });

  it('12. Inactive account returns HTTP 403', async () => {
    const server = await buildServer();
    const regRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });
    const regBody = JSON.parse(regRes.payload);
    const userId = regBody.user.id;

    // Deactivate user
    await setUserActiveStatus(userId, false);

    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: validBuyerPayload.email,
        password: validBuyerPayload.password
      }
    });

    assert.strictEqual(loginRes.statusCode, 403);
    const body = JSON.parse(loginRes.payload);
    assert.match(body.message, /deactivated/i);
    await server.close();
  });

  it('13. An unverified/provisional buyer may log in', async () => {
    const server = await buildServer();
    const regRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });
    const regBody = JSON.parse(regRes.payload);
    assert.strictEqual(regBody.user.isEmailVerified, false, 'Account must start in provisional state');

    // Login succeeds despite unverified email
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: validBuyerPayload.email,
        password: validBuyerPayload.password
      }
    });

    assert.strictEqual(loginRes.statusCode, 200);
    await server.close();
  });

  it('14. /me succeeds with a valid buyer cookie', async () => {
    const server = await buildServer();
    const regRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });

    const setCookie = regRes.headers['set-cookie'] as string;
    const cookieToken = setCookie.split(';')[0]; // aweer_session=...

    const meRes = await server.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        cookie: cookieToken
      }
    });

    assert.strictEqual(meRes.statusCode, 200);
    const body = JSON.parse(meRes.payload);
    assert.strictEqual(body.user.email, validBuyerPayload.email);
    assert.strictEqual(body.user.role, UserRole.BUYER);
    await server.close();
  });

  it('15. /me returns HTTP 401 without a cookie', async () => {
    const server = await buildServer();
    const meRes = await server.inject({
      method: 'GET',
      url: '/api/v1/auth/me'
    });

    assert.strictEqual(meRes.statusCode, 401);
    const body = JSON.parse(meRes.payload);
    assert.match(body.message, /token is required/i);
    await server.close();
  });

  it('16. /me rejects invalid, expired, and wrong-role sessions', async () => {
    const server = await buildServer();
    // 1. Invalid signature
    const invalidCookie = 'aweer_session=malformed_payload.bad_signature_hex';
    const res1 = await server.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: invalidCookie }
    });
    assert.strictEqual(res1.statusCode, 401);

    // 2. Expired buyer token
    const expiredToken = signSessionToken(
      {
        userId: 'b1',
        role: UserRole.BUYER,
        email: 'buyer@test.com',
        expiresAt: Date.now() - 5000 // In the past
      },
      TEST_SECRET
    );
    const res2 = await server.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: `aweer_session=${expiredToken}` }
    });
    assert.strictEqual(res2.statusCode, 401);

    // 3. Wrong role (Shop Admin token attempting buyer /me)
    const shopAdminToken = signSessionToken(
      {
        userId: 's1',
        role: UserRole.SHOP_ADMIN,
        email: 'admin@shop.com'
      },
      TEST_SHOP_SECRET
    );
    const res3 = await server.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: `aweer_session=${shopAdminToken}` }
    });
    assert.strictEqual(res3.statusCode, 401);
    const body3 = JSON.parse(res3.payload);
    assert.match(body3.message, /valid buyer session required/i);
    await server.close();
  });

  it('17. /me rejects deactivated accounts', async () => {
    const server = await buildServer();
    const regRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: validBuyerPayload
    });

    const setCookie = regRes.headers['set-cookie'] as string;
    const cookieToken = setCookie.split(';')[0];
    const regBody = JSON.parse(regRes.payload);
    const userId = regBody.user.id;

    // Deactivate user after issuing token
    await setUserActiveStatus(userId, false);

    // /me must re-query user status and reject
    const meRes = await server.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: cookieToken }
    });

    assert.strictEqual(meRes.statusCode, 403);
    const body = JSON.parse(meRes.payload);
    assert.match(body.message, /deactivated/i);
    await server.close();
  });

  it('18. Logout clears the cookie with compatible cookie attributes', async () => {
    const server = await buildServer();
    const logoutRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/logout'
    });

    assert.strictEqual(logoutRes.statusCode, 200);
    const body = JSON.parse(logoutRes.payload);
    assert.strictEqual(body.message, 'Logged out successfully');

    const setCookie = logoutRes.headers['set-cookie'] as string;
    assert.ok(setCookie);
    assert.match(setCookie, /aweer_session=;/);
    assert.match(setCookie, /Max-Age=0/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\/api\/v1/);
    await server.close();
  });
});
