/**
 * AweerMarket Frontend Authentication Pages Validation & Contract Unit Tests
 * Uses native Node.js test runner (node --test) without external dependencies.
 * Asserts client-side schema validation rules, security constraints, and error mappings for /register and /login.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RegisterBuyerSchema, LoginSchema } from '@aweermarket/validation';
import { ApiClientError } from '../src/lib/api-client.ts';

describe('Phase 3.2-B: Frontend Buyer Auth Pages — Validation & Contracts', () => {

  // ==========================================================================
  // 1. Buyer Registration Form Validation Rules
  // ==========================================================================
  describe('1. Buyer Registration Validation (RegisterBuyerSchema)', () => {
    const validBuyer = {
      fullName: 'Fatima Al Mansoori',
      email: 'Fatima@AweerMarket.AE',
      password: 'SecurePassword123!',
      phone: '+971501234567',
      businessName: 'Fresh Oasis Restaurant LLC',
      tradeLicenseNumber: 'CN-9876543'
    };

    it('accepts valid buyer registration input and normalizes email to lowercase', () => {
      const result = RegisterBuyerSchema.safeParse(validBuyer);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.email, 'fatima@aweermarket.ae', 'Email must be lowercased');
        assert.strictEqual(result.data.fullName, 'Fatima Al Mansoori');
        assert.strictEqual(result.data.phone, '+971501234567');
      }
    });

    it('accepts buyer registration without optional businessName or tradeLicenseNumber', () => {
      const minimalBuyer = {
        fullName: 'Ahmed Al Marri',
        email: 'ahmed@aweer.ae',
        password: 'Password123!',
        phone: '+971550000000'
      };
      const result = RegisterBuyerSchema.safeParse(minimalBuyer);
      assert.strictEqual(result.success, true);
    });

    it('REJECTS client-submitted role attempt (Privilege Escalation Prevention)', () => {
      const tamperAttempt = {
        ...validBuyer,
        role: 'super_admin'
      };
      const result = RegisterBuyerSchema.safeParse(tamperAttempt);
      assert.strictEqual(result.success, false, 'Schema must reject any client-submitted role');
    });

    it('REJECTS client-submitted shopId attempt (Cross-Tenant Scope Injection Prevention)', () => {
      const tamperAttempt = {
        ...validBuyer,
        shopId: 'shop_stall_99'
      };
      const result = RegisterBuyerSchema.safeParse(tamperAttempt);
      assert.strictEqual(result.success, false, 'Schema must reject client-submitted shopId');
    });

    it('rejects missing or invalid email format', () => {
      const badEmail = { ...validBuyer, email: 'not-an-email' };
      const result = RegisterBuyerSchema.safeParse(badEmail);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues.some((i) => i.path[0] === 'email'));
      }
    });

    it('rejects short passwords (< 8 characters)', () => {
      const shortPass = { ...validBuyer, password: 'short' };
      const result = RegisterBuyerSchema.safeParse(shortPass);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues.some((i) => i.path[0] === 'password'));
      }
    });

    it('rejects short phone numbers (< 7 digits)', () => {
      const shortPhone = { ...validBuyer, phone: '123' };
      const result = RegisterBuyerSchema.safeParse(shortPhone);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues.some((i) => i.path[0] === 'phone'));
      }
    });

    it('rejects empty or whitespace-only full name', () => {
      const emptyName = { ...validBuyer, fullName: '   ' };
      const result = RegisterBuyerSchema.safeParse(emptyName);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues.some((i) => i.path[0] === 'fullName'));
      }
    });
  });

  // ==========================================================================
  // 2. Buyer Login Form Validation Rules
  // ==========================================================================
  describe('2. Buyer Login Validation (LoginSchema)', () => {
    it('accepts valid credentials and normalizes email', () => {
      const validCreds = { email: ' Buyer@Aweer.ae ', password: 'Password123!' };
      const result = LoginSchema.safeParse(validCreds);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.email, 'buyer@aweer.ae');
      }
    });

    it('rejects invalid email format on login', () => {
      const badCreds = { email: 'invalid-email', password: 'Password123!' };
      const result = LoginSchema.safeParse(badCreds);
      assert.strictEqual(result.success, false);
    });

    it('rejects password shorter than 8 characters on login', () => {
      const badCreds = { email: 'buyer@aweer.ae', password: '123' };
      const result = LoginSchema.safeParse(badCreds);
      assert.strictEqual(result.success, false);
    });

    it('rejects unexpected fields on login (strict schema)', () => {
      const tamperCreds = { email: 'buyer@aweer.ae', password: 'Password123!', role: 'admin' };
      const result = LoginSchema.safeParse(tamperCreds);
      assert.strictEqual(result.success, false);
    });
  });

  // ==========================================================================
  // 3. UI Error Code Handling & Sanitization
  // ==========================================================================
  describe('3. UI Error Code Handling', () => {
    it('ApiClientError retains status 409 for duplicate registration handling', () => {
      const err = new ApiClientError('An account with this email already exists', 409, 'Conflict');
      assert.strictEqual(err.statusCode, 409);
      assert.strictEqual(err.message, 'An account with this email already exists');
    });

    it('ApiClientError retains status 401 for generic invalid credentials handling', () => {
      const err = new ApiClientError('Invalid email or password', 401, 'Unauthorized');
      assert.strictEqual(err.statusCode, 401);
      assert.strictEqual(err.message, 'Invalid email or password');
    });

    it('ApiClientError retains status 403 for deactivated account message', () => {
      const err = new ApiClientError('Account has been deactivated. Please contact support.', 403, 'Forbidden');
      assert.strictEqual(err.statusCode, 403);
      assert.match(err.message, /deactivated/i);
    });

    it('ApiClientError retains status 503 for database unavailable protection', () => {
      const err = new ApiClientError('Service temporarily unavailable. Please try again later.', 503, 'Service Unavailable');
      assert.strictEqual(err.statusCode, 503);
      assert.strictEqual(err.errorTitle, 'Service Unavailable');
    });
  });
});
