import { describe, it } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import { UserRole, AuthSessionPayload } from '@aweermarket/types';
import { buildServer } from './server.js';
import { 
  hashPassword, 
  verifyPassword, 
  signSessionToken, 
  verifySessionToken, 
  MAX_PASSWORD_LENGTH, 
  MAX_PASSWORD_BYTES 
} from './utils/crypto.js';
import { 
  authenticate, 
  requireRole, 
  requireTenantScope, 
  getSecretForRole, 
  validateSecret, 
  validateAllSecrets,
  securityPlugin,
  MIN_SECRET_LENGTH 
} from './plugins/security.js';

// Test secrets with >= 32 characters for safe test isolation
const TEST_BUYER_SECRET = 'test_buyer_secret_minimum_32_characters_long_ok!';
const TEST_SHOP_SECRET = 'test_shopadmin_secret_minimum_32_characters_ok!';
const TEST_SUPER_SECRET = 'test_superadmin_secret_minimum_32_characters_ok!';

const testConfigOverride = {
  jwtSecret: TEST_BUYER_SECRET,
  adminJwtSecret: TEST_SHOP_SECRET,
  superAdminJwtSecret: TEST_SUPER_SECRET
};

describe('SEC-01: Fail Closed on Missing or Weak Secrets', () => {
  it('validateSecret throws when secret is missing or empty', () => {
    assert.throws(() => {
      validateSecret('JWT_SECRET', undefined);
    }, /Missing required signing secret 'JWT_SECRET'/i);

    assert.throws(() => {
      validateSecret('JWT_SECRET', '   ');
    }, /Missing required signing secret 'JWT_SECRET'/i);
  });

  it('validateSecret throws when secret is shorter than 32 characters', () => {
    assert.throws(() => {
      validateSecret('JWT_SECRET', 'too_short_secret');
    }, /must be at least 32 characters long/i);
  });

  it('validateSecret error messages NEVER leak secret contents', () => {
    try {
      validateSecret('TEST_KEY', 'weak_secret_123');
      assert.fail('Should have thrown');
    } catch (err: unknown) {
      const msg = (err as Error).message;
      assert.ok(!msg.includes('weak_secret_123'), 'Secret value must not appear in error message');
      assert.ok(msg.includes('TEST_KEY'));
    }
  });

  it('validateAllSecrets throws when JWT_SECRET is missing or weak', () => {
    assert.throws(() => {
      validateAllSecrets({ jwtSecret: '' });
    }, /Missing required signing secret 'JWT_SECRET'/i);

    assert.throws(() => {
      validateAllSecrets({ jwtSecret: 'too_short' });
    }, /must be at least 32 characters long/i);
  });

  it('validateAllSecrets rejects identical Super Admin and Buyer secrets', () => {
    assert.throws(() => {
      validateAllSecrets({
        jwtSecret: TEST_BUYER_SECRET,
        superAdminJwtSecret: TEST_BUYER_SECRET
      });
    }, /cannot be identical to 'JWT_SECRET'/i);
  });

  it('getSecretForRole rejects fallback and enforces role-bound secret configuration', () => {
    const buyerKey = getSecretForRole(UserRole.BUYER, testConfigOverride);
    const shopKey = getSecretForRole(UserRole.SHOP_ADMIN, testConfigOverride);
    const superKey = getSecretForRole(UserRole.SUPER_ADMIN, testConfigOverride);

    assert.strictEqual(buyerKey, TEST_BUYER_SECRET);
    assert.strictEqual(shopKey, TEST_SHOP_SECRET);
    assert.strictEqual(superKey, TEST_SUPER_SECRET);
    assert.notStrictEqual(buyerKey, superKey, 'Buyer and Super Admin keys must be distinct in isolated setup');
    assert.notStrictEqual(buyerKey, shopKey, 'Buyer and Shop Admin keys must be distinct in isolated setup');
    assert.notStrictEqual(shopKey, superKey, 'Shop Admin and Super Admin keys must be distinct in isolated setup');
  });

  it('getSecretForRole derives cryptographically distinct keys in shared-secret configuration', () => {
    const sharedConfig = { jwtSecret: TEST_BUYER_SECRET };
    const buyerKey = getSecretForRole(UserRole.BUYER, sharedConfig);
    const shopKey = getSecretForRole(UserRole.SHOP_ADMIN, sharedConfig);
    const superKey = getSecretForRole(UserRole.SUPER_ADMIN, sharedConfig);

    assert.strictEqual(buyerKey, TEST_BUYER_SECRET);
    assert.notStrictEqual(buyerKey, shopKey, 'Derived shop key must differ from buyer key');
    assert.notStrictEqual(buyerKey, superKey, 'Derived super key must differ from buyer key');
    assert.notStrictEqual(shopKey, superKey, 'Derived super key must differ from shop key');
    assert.strictEqual(superKey.length, 64, 'Derived super key must be 64-char HMAC-SHA256 hex');
  });
});

describe('SEC-02: Role-Bound Signature Verification & Privilege Escalation Prevention', () => {
  async function createSecuredApp() {
    // Set environment secrets for this test app instance
    process.env.JWT_SECRET = TEST_BUYER_SECRET;
    process.env.ADMIN_JWT_SECRET = TEST_SHOP_SECRET;
    process.env.SUPER_ADMIN_JWT_SECRET = TEST_SUPER_SECRET;

    const app = Fastify();
    await app.register(securityPlugin);

    app.get(
      '/api/buyer/profile',
      { preHandler: [authenticate, requireRole(UserRole.BUYER)] },
      async (req) => ({ user: req.user?.userId, role: req.user?.role })
    );

    app.get(
      '/api/shopadmin/:shopId',
      { preHandler: [authenticate, requireRole(UserRole.SHOP_ADMIN), requireTenantScope('shopId')] },
      async (req) => ({ shop: req.user?.shopId, role: req.user?.role })
    );

    app.get(
      '/api/superadmin/governance',
      { preHandler: [authenticate, requireRole(UserRole.SUPER_ADMIN)] },
      async (req) => ({ super: true, role: req.user?.role })
    );

    return app;
  }

  it('Accepts a valid buyer token signed with Buyer key', async () => {
    const app = await createSecuredApp();
    const token = signSessionToken(
      { userId: 'b1', role: UserRole.BUYER, email: 'buyer@test.com' },
      TEST_BUYER_SECRET
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/buyer/profile',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.role, UserRole.BUYER);
    await app.close();
  });

  it('REJECTS token signed with Buyer key claiming super_admin (SEC-02 Core Defense)', async () => {
    const app = await createSecuredApp();
    // Attacker signs payload claiming super_admin using buyer key
    const forgedSuperToken = signSessionToken(
      { userId: 'attacker_1', role: UserRole.SUPER_ADMIN, email: 'attacker@evil.com' },
      TEST_BUYER_SECRET
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/superadmin/governance',
      headers: { authorization: `Bearer ${forgedSuperToken}` }
    });

    // authenticate() must detect signature mismatch for super_admin role and reject with 401
    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.match(body.message, /invalid token signature for claimed role/i);
    await app.close();
  });

  it('REJECTS token signed with Buyer key claiming shop_admin', async () => {
    const app = await createSecuredApp();
    const forgedShopToken = signSessionToken(
      { userId: 'attacker_2', role: UserRole.SHOP_ADMIN, shopId: 'shop_1', email: 'attacker@evil.com' },
      TEST_BUYER_SECRET
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/shopadmin/shop_1',
      headers: { authorization: `Bearer ${forgedShopToken}` }
    });

    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.match(body.message, /invalid token signature for claimed role/i);
    await app.close();
  });

  it('REJECTS token signed with Shop Admin key claiming super_admin', async () => {
    const app = await createSecuredApp();
    const forgedSuperFromShop = signSessionToken(
      { userId: 'shop_admin_1', role: UserRole.SUPER_ADMIN, email: 'rogue_admin@shop.com' },
      TEST_SHOP_SECRET
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/superadmin/governance',
      headers: { authorization: `Bearer ${forgedSuperFromShop}` }
    });

    assert.strictEqual(res.statusCode, 401);
    await app.close();
  });

  it('Accepts a Super Admin token signed with Super Admin key', async () => {
    const app = await createSecuredApp();
    const validSuperToken = signSessionToken(
      { userId: 'owner_1', role: UserRole.SUPER_ADMIN, email: 'owner@aweermarket.ae', isMfaVerified: true },
      TEST_SUPER_SECRET
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/superadmin/governance',
      headers: { authorization: `Bearer ${validSuperToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.super, true);
    await app.close();
  });

  it('REJECTS unknown, missing, or malformed role claims', async () => {
    const app = await createSecuredApp();
    // Unknown role
    const unknownRoleToken = signSessionToken(
      { userId: 'u1', role: 'god_mode' as unknown as UserRole, email: 'test@evil.com' },
      TEST_BUYER_SECRET
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/buyer/profile',
      headers: { authorization: `Bearer ${unknownRoleToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.match(body.message, /unrecognized role claim/i);
    await app.close();
  });

  it('Legacy VENDOR and ADMIN aliases cannot escalate to Super Admin', async () => {
    const app = await createSecuredApp();
    // Legacy vendor alias token signed with shop secret
    const vendorToken = signSessionToken(
      { userId: 'v1', role: UserRole.VENDOR, shopId: 'stall_5', email: 'vendor@aweer.ae' },
      TEST_SHOP_SECRET
    );

    // Try accessing superadmin route
    const res = await app.inject({
      method: 'GET',
      url: '/api/superadmin/governance',
      headers: { authorization: `Bearer ${vendorToken}` }
    });

    // requireRole(SUPER_ADMIN) must reject
    assert.strictEqual(res.statusCode, 403);
    await app.close();
  });

  it('REJECTS tampered token signature (signature bytes modified)', async () => {
    const app = await createSecuredApp();
    const token = signSessionToken(
      { userId: 'b1', role: UserRole.BUYER, email: 'buyer@test.com' },
      TEST_BUYER_SECRET
    );
    // Tamper with last character of signature hex
    const tampered = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');

    const res = await app.inject({
      method: 'GET',
      url: '/api/buyer/profile',
      headers: { authorization: `Bearer ${tampered}` }
    });

    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.match(body.message, /invalid token signature/i);
    await app.close();
  });

  it('REJECTS expired tokens', async () => {
    const app = await createSecuredApp();
    const expiredToken = signSessionToken(
      { 
        userId: 'b1', 
        role: UserRole.BUYER, 
        email: 'buyer@test.com',
        expiresAt: Date.now() - 5000 // 5 seconds in the past
      },
      TEST_BUYER_SECRET
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/buyer/profile',
      headers: { authorization: `Bearer ${expiredToken}` }
    });

    assert.strictEqual(res.statusCode, 401);
    await app.close();
  });

  it('REJECTS tokens missing valid userId subject claim', async () => {
    const app = await createSecuredApp();
    const tokenWithoutUser = signSessionToken(
      { userId: '', role: UserRole.BUYER, email: 'buyer@test.com' },
      TEST_BUYER_SECRET
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/buyer/profile',
      headers: { authorization: `Bearer ${tokenWithoutUser}` }
    });

    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.match(body.message, /invalid token subject claim/i);
    await app.close();
  });

  it('REJECTS tokens with malformed JSON payload structure', async () => {
    const app = await createSecuredApp();
    const malformedPayloadBase64 = Buffer.from('not-valid-json').toString('base64url');
    const fakeSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const malformedToken = `${malformedPayloadBase64}.${fakeSignature}`;

    const res = await app.inject({
      method: 'GET',
      url: '/api/buyer/profile',
      headers: { authorization: `Bearer ${malformedToken}` }
    });

    assert.strictEqual(res.statusCode, 401);
    await app.close();
  });

  it('Shared JWT_SECRET configuration still prevents cross-role privilege escalation', async () => {
    // Simulate shared secret environment where only JWT_SECRET is configured
    process.env.JWT_SECRET = TEST_BUYER_SECRET;
    delete process.env.ADMIN_JWT_SECRET;
    delete process.env.SUPER_ADMIN_JWT_SECRET;

    const app = Fastify();
    await app.register(securityPlugin);
    app.get(
      '/api/superadmin/governance',
      { preHandler: [authenticate, requireRole(UserRole.SUPER_ADMIN)] },
      async () => ({ super: true })
    );

    // Attacker signs payload claiming super_admin using shared buyer secret
    const forgedSuperToken = signSessionToken(
      { userId: 'attacker_3', role: UserRole.SUPER_ADMIN, email: 'attacker@evil.com' },
      TEST_BUYER_SECRET
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/superadmin/governance',
      headers: { authorization: `Bearer ${forgedSuperToken}` }
    });

    // Must be rejected because derived super key differs from buyer key
    assert.strictEqual(res.statusCode, 401);
    await app.close();
  });
});

describe('SEC-03: Maximum Password Input Length Protection', () => {
  it('hashPassword accepts passwords up to 128 characters and verifies correctly', async () => {
    const exactly128Chars = 'P@ssw0rd!'.padEnd(128, 'x');
    assert.strictEqual(exactly128Chars.length, 128);

    const hash = await hashPassword(exactly128Chars);
    assert.ok(hash.startsWith('scrypt$'));

    const isMatch = await verifyPassword(exactly128Chars, hash);
    assert.strictEqual(isMatch, true);
  });

  it('hashPassword throws when password exceeds 128 characters (DoS Prevention)', async () => {
    const oversized129Chars = 'a'.repeat(129);
    await assert.rejects(async () => {
      await hashPassword(oversized129Chars);
    }, /exceeds maximum allowed length of 128 characters/i);
  });

  it('hashPassword throws when password byte length exceeds 512 bytes', async () => {
    // 4-byte emoji repeated 130 times = 520 bytes
    const multibyteOversized = '🛡️'.repeat(130);
    await assert.rejects(async () => {
      await hashPassword(multibyteOversized);
    }, /exceeds maximum allowed length/i);
  });

  it('hashPassword rejects empty or non-string password input', async () => {
    await assert.rejects(async () => {
      await hashPassword('');
    }, /Password cannot be empty/i);

    await assert.rejects(async () => {
      await hashPassword(null as unknown as string);
    }, /Password must be a string/i);
  });

  it('verifyPassword safely returns false for oversized inputs without scrypt computation', async () => {
    const validHash = await hashPassword('ValidPass123!');
    const oversized = 'a'.repeat(500);

    // Must return false in constant time, not throw or compute
    const result = await verifyPassword(oversized, validHash);
    assert.strictEqual(result, false);
  });

  it('verifyPassword returns false for wrong password on valid hash', async () => {
    const validHash = await hashPassword('CorrectPassword123!');
    const isMatch = await verifyPassword('WrongPassword123!', validHash);
    assert.strictEqual(isMatch, false);
  });

  it('verifyPassword safely handles malformed hashes and non-string inputs', async () => {
    assert.strictEqual(await verifyPassword('test', 'not-a-valid-hash'), false);
    assert.strictEqual(await verifyPassword('test', 'scrypt$invalid$hash'), false);
    assert.strictEqual(await verifyPassword('', 'scrypt$abc$def'), false);
  });
});

describe('Healthcheck Separation & Multi-Tenant Scoping Regression', () => {
  it('GET /health/live returns 200 OK independently of database connectivity', async () => {
    const server = await buildServer();
    const response = await server.inject({ method: 'GET', url: '/health/live' });
    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.check, 'liveness');
    await server.close();
  });

  it('GET /health/ready returns 503 Unavailable when database is disconnected', async () => {
    const server = await buildServer();
    const response = await server.inject({ method: 'GET', url: '/health/ready' });
    assert.strictEqual(response.statusCode, 503);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, 'unavailable');
    assert.strictEqual(body.database, 'disconnected');
    await server.close();
  });

  it('PREVENTS CROSS-TENANT ACCESS: Shop Admin A cannot access Shop B data (403 Forbidden)', async () => {
    process.env.JWT_SECRET = TEST_BUYER_SECRET;
    process.env.ADMIN_JWT_SECRET = TEST_SHOP_SECRET;

    const app = Fastify();
    await app.register(securityPlugin);
    app.get(
      '/shop/:shopId/orders',
      { preHandler: [authenticate, requireRole(UserRole.SHOP_ADMIN), requireTenantScope('shopId')] },
      async () => ({ orders: [] })
    );

    const shop10Token = signSessionToken(
      { userId: 'admin_1', role: UserRole.SHOP_ADMIN, shopId: 'shop_10', email: 'admin@shop10.ae' },
      TEST_SHOP_SECRET
    );

    // Try accessing shop_20
    const res = await app.inject({
      method: 'GET',
      url: '/shop/shop_20/orders',
      headers: { authorization: `Bearer ${shop10Token}` }
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.payload);
    assert.match(body.message, /cross-tenant access denied/i);
    await app.close();
  });
});
