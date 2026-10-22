import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  RegisterBuyerSchema, 
  LoginSchema, 
  ShopAdminLoginSchema, 
  SuperAdminLoginSchema, 
  MfaTokenSchema 
} from '../dist/index.js';
import { UserRole, isShopAdminRole, isSuperAdminRole } from '../../types/dist/index.js';

describe('Validation Contracts — Security & Integrity', () => {
  it('RegisterBuyerSchema accepts valid buyer input and normalizes email', () => {
    const input = {
      email: '  Buyer@AweerMarket.COM  ',
      password: 'StrongPassword123!',
      fullName: 'Ahmed Al Aweer',
      phone: '+971501234567'
    };

    const parsed = RegisterBuyerSchema.parse(input);
    assert.strictEqual(parsed.email, 'buyer@aweermarket.com');
    assert.strictEqual(parsed.fullName, 'Ahmed Al Aweer');
    assert.strictEqual(parsed.phone, '+971501234567');
  });

  it('RegisterBuyerSchema REJECTS client-submitted role attempt (Privilege Escalation Prevention)', () => {
    const maliciousInput = {
      email: 'attacker@example.com',
      password: 'Password1234',
      fullName: 'Attacker Name',
      phone: '+971500000000',
      role: 'super_admin' // Attempted privilege escalation
    };

    assert.throws(() => {
      RegisterBuyerSchema.parse(maliciousInput);
    }, /unrecognized_keys/i);
  });

  it('RegisterBuyerSchema REJECTS client-submitted shopId attempt', () => {
    const maliciousInput = {
      email: 'attacker@example.com',
      password: 'Password1234',
      fullName: 'Attacker Name',
      phone: '+971500000000',
      shopId: 'shop_stall_101' // Attempted tenant spoofing
    };

    assert.throws(() => {
      RegisterBuyerSchema.parse(maliciousInput);
    }, /unrecognized_keys/i);
  });

  it('LoginSchema normalizes email and enforces password minimum length', () => {
    const shortPassword = {
      email: 'user@test.com',
      password: '123'
    };

    assert.throws(() => {
      LoginSchema.parse(shortPassword);
    }, /at least 8 characters/i);

    const valid = LoginSchema.parse({
      email: '  User@TEST.COM ',
      password: 'validPassword123'
    });
    assert.strictEqual(valid.email, 'user@test.com');

    // 128-character boundary test (SEC-03)
    const exactly128 = 'A'.repeat(128);
    const valid128 = LoginSchema.parse({
      email: 'user@test.com',
      password: exactly128
    });
    assert.strictEqual(valid128.password.length, 128);

    // 129-character rejection test (SEC-03)
    const oversized129 = 'A'.repeat(129);
    assert.throws(() => {
      LoginSchema.parse({
        email: 'user@test.com',
        password: oversized129
      });
    }, /cannot exceed 128 characters/i);

    assert.throws(() => {
      RegisterBuyerSchema.parse({
        email: 'buyer@test.com',
        password: oversized129,
        fullName: 'Test Buyer',
        phone: '+971501234567'
      });
    }, /cannot exceed 128 characters/i);

    assert.throws(() => {
      ShopAdminLoginSchema.parse({
        email: 'admin@shop.com',
        password: oversized129
      });
    }, /cannot exceed 128 characters/i);

    assert.throws(() => {
      SuperAdminLoginSchema.parse({
        email: 'owner@aweer.ae',
        password: oversized129
      });
    }, /cannot exceed 128 characters/i);

    // Multibyte Unicode boundary test (SEC-03: max 512 bytes)
    // 4-byte emoji repeated 130 times = 520 bytes
    const multibyteOversized = '🛡️'.repeat(130);
    assert.throws(() => {
      LoginSchema.parse({
        email: 'user@test.com',
        password: multibyteOversized
      });
    }, /exceed 512 bytes|cannot exceed 128 characters/i);
  });

  it('MfaTokenSchema enforces exactly 6 numeric digits', () => {
    assert.strictEqual(MfaTokenSchema.parse('123456'), '123456');

    // Non-numeric
    assert.throws(() => MfaTokenSchema.parse('abcdef'));
    // Too short
    assert.throws(() => MfaTokenSchema.parse('12345'));
    // Too long
    assert.throws(() => MfaTokenSchema.parse('1234567'));
  });

  it('SuperAdminLoginSchema accepts valid credentials with optional MFA token', () => {
    const withoutMfa = SuperAdminLoginSchema.parse({
      email: 'superadmin@aweermarket.ae',
      password: 'SuperAdminSecret123'
    });
    assert.strictEqual(withoutMfa.email, 'superadmin@aweermarket.ae');

    const withMfa = SuperAdminLoginSchema.parse({
      email: 'superadmin@aweermarket.ae',
      password: 'SuperAdminSecret123',
      mfaToken: '654321'
    });
    assert.strictEqual(withMfa.mfaToken, '654321');
  });

  it('UserRole enum preserves backward-compatibility aliases and helper guards', () => {
    assert.strictEqual(UserRole.BUYER, 'buyer');
    assert.strictEqual(UserRole.SHOP_ADMIN, 'shop_admin');
    assert.strictEqual(UserRole.SUPER_ADMIN, 'super_admin');
    assert.strictEqual(UserRole.VENDOR, 'vendor');
    assert.strictEqual(UserRole.ADMIN, 'admin');

    // Type guards
    assert.strictEqual(isShopAdminRole(UserRole.SHOP_ADMIN), true);
    assert.strictEqual(isShopAdminRole(UserRole.VENDOR), true);
    assert.strictEqual(isShopAdminRole(UserRole.ADMIN), true);
    assert.strictEqual(isShopAdminRole(UserRole.BUYER), false);

    assert.strictEqual(isSuperAdminRole(UserRole.SUPER_ADMIN), true);
    assert.strictEqual(isSuperAdminRole(UserRole.ADMIN), false);
    assert.strictEqual(isSuperAdminRole(UserRole.SHOP_ADMIN), false);
  });
});
