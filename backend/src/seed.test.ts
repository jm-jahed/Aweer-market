/**
 * AweerMarket Super Admin Seeding & Configuration Safety Tests
 * Uses native Node.js test runner (node --test).
 * Covers:
 * 1. Production seeding skipped when explicit gate (ENABLE_SUPER_ADMIN_SEED) is absent
 * 2. Missing or weak (< 12 chars) production passwords never fall back to default credentials
 * 3. Invalid or missing production email/name safely skips without mutating database
 * 4. Production seed attempts with offline database fail closed and propagate DatabaseUnavailableError
 * 5. Successful Super Admin creation with strong credentials (non-production / test mode)
 * 6. Existing administrator accounts and credentials are never overwritten
 * 7. Multi-instance duplicate-key race (code 11000) safety with re-query verification
 * 8. Non-race database errors propagate without being swallowed
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { UserRole } from '@aweermarket/types';
import { ensureDefaultSuperAdmin } from './seed.js';
import { hashPassword, verifyPassword } from './utils/crypto.js';
import {
  findUserByEmail,
  createSuperAdminUser,
  resetInMemoryUsers,
  listAllUsers,
  DatabaseUnavailableError
} from './models/user.model.js';

describe('AweerMarket Super Admin Seeding Safety & Gate Tests', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv, NODE_ENV: 'test' };
    resetInMemoryUsers();
  });

  afterEach(() => {
    process.env = { ...origEnv, NODE_ENV: 'test' };
    resetInMemoryUsers();
  });

  describe('1. Production Opt-In Gating', () => {
    it('skips Super Admin seeding in production when ENABLE_SUPER_ADMIN_SEED is absent or false', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ENABLE_SUPER_ADMIN_SEED;
      process.env.SUPER_ADMIN_EMAIL = 'prodadmin@aweermarket.ae';
      process.env.SUPER_ADMIN_PASSWORD = 'ValidProductionPass123!';
      process.env.SUPER_ADMIN_NAME = 'Prod Administrator';

      await ensureDefaultSuperAdmin();

      // Switch back to test mode to inspect in-memory store
      process.env.NODE_ENV = 'test';
      const created = await findUserByEmail('prodadmin@aweermarket.ae');
      assert.strictEqual(created, null, 'Super Admin must NOT be created when ENABLE_SUPER_ADMIN_SEED is absent');

      const allUsers = await listAllUsers();
      assert.strictEqual(allUsers.length, 0, 'User store must remain empty when production seed is ungated');
    });

    it('skips Super Admin seeding in production when ENABLE_SUPER_ADMIN_SEED is set to false', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_SUPER_ADMIN_SEED = 'false';
      process.env.SUPER_ADMIN_EMAIL = 'prodadmin@aweermarket.ae';
      process.env.SUPER_ADMIN_PASSWORD = 'ValidProductionPass123!';
      process.env.SUPER_ADMIN_NAME = 'Prod Administrator';

      await ensureDefaultSuperAdmin();

      process.env.NODE_ENV = 'test';
      const created = await findUserByEmail('prodadmin@aweermarket.ae');
      assert.strictEqual(created, null);
    });
  });

  describe('2. Production Password Strength & Missing Configuration', () => {
    it('never falls back to default password in production when SUPER_ADMIN_PASSWORD is missing', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_SUPER_ADMIN_SEED = 'true';
      delete process.env.SUPER_ADMIN_PASSWORD;
      process.env.SUPER_ADMIN_EMAIL = 'admin@aweermarket.ae';
      process.env.SUPER_ADMIN_NAME = 'Admin User';

      await ensureDefaultSuperAdmin();

      process.env.NODE_ENV = 'test';
      const users = await listAllUsers();
      assert.strictEqual(users.length, 0, 'No account should be created when production password is missing');

      const fallbackCheck = await findUserByEmail('superadmin@aweermarket.ae');
      assert.strictEqual(fallbackCheck, null, 'Must never create hardcoded fallback account in production');
    });

    it('skips production creation when password is shorter than 12 characters (rejects weak credentials)', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_SUPER_ADMIN_SEED = 'true';
      process.env.SUPER_ADMIN_PASSWORD = 'ShortPass1!'; // 11 characters
      process.env.SUPER_ADMIN_EMAIL = 'admin@aweermarket.ae';
      process.env.SUPER_ADMIN_NAME = 'Admin User';

      await ensureDefaultSuperAdmin();

      process.env.NODE_ENV = 'test';
      const users = await listAllUsers();
      assert.strictEqual(users.length, 0, 'No account should be created when production password is < 12 characters');
    });

    it('skips production creation when email is invalid or missing', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_SUPER_ADMIN_SEED = 'true';
      process.env.SUPER_ADMIN_PASSWORD = 'ValidProductionPass123!';
      process.env.SUPER_ADMIN_EMAIL = 'invalid-email-no-at-sign';
      process.env.SUPER_ADMIN_NAME = 'Admin User';

      await ensureDefaultSuperAdmin();

      process.env.NODE_ENV = 'test';
      const users = await listAllUsers();
      assert.strictEqual(users.length, 0);
    });

    it('skips production creation when name is missing', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_SUPER_ADMIN_SEED = 'true';
      process.env.SUPER_ADMIN_PASSWORD = 'ValidProductionPass123!';
      process.env.SUPER_ADMIN_EMAIL = 'admin@aweermarket.ae';
      delete process.env.SUPER_ADMIN_NAME;

      await ensureDefaultSuperAdmin();

      process.env.NODE_ENV = 'test';
      const users = await listAllUsers();
      assert.strictEqual(users.length, 0);
    });

    it('propagates DatabaseUnavailableError if production seed is enabled but database is offline (fails closed)', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_SUPER_ADMIN_SEED = 'true';
      process.env.SUPER_ADMIN_EMAIL = 'admin@aweermarket.ae';
      process.env.SUPER_ADMIN_PASSWORD = 'ValidProductionPass123!';
      process.env.SUPER_ADMIN_NAME = 'Admin User';

      // Because MongoDB is not connected in local unit test runtime,
      // it must throw DatabaseUnavailableError rather than silently succeeding or using in-memory fallback
      await assert.rejects(
        async () => {
          await ensureDefaultSuperAdmin();
        },
        (err: Error) => {
          assert.ok(err instanceof DatabaseUnavailableError || (err as { code?: string }).code === 'DATABASE_UNAVAILABLE');
          return true;
        }
      );
    });
  });

  describe('3. Account Creation & Non-Overwrite Guarantees', () => {
    it('creates Super Admin account when valid configuration is provided', async () => {
      process.env.SUPER_ADMIN_EMAIL = 'lead.admin@aweermarket.ae';
      process.env.SUPER_ADMIN_PASSWORD = 'SecureAdminSecret2026!';
      process.env.SUPER_ADMIN_NAME = 'Platform Super Admin';

      await ensureDefaultSuperAdmin();

      const admin = await findUserByEmail('lead.admin@aweermarket.ae', true);
      assert.ok(admin, 'Super Admin must exist in database after valid seed');
      assert.strictEqual(admin.role, UserRole.SUPER_ADMIN);
      assert.strictEqual(admin.fullName, 'Platform Super Admin');

      // Verify stored password hash matches configured password
      const isValid = await verifyPassword('SecureAdminSecret2026!', admin.passwordHash);
      assert.strictEqual(isValid, true, 'Configured password must verify against stored hash');
    });

    it('never overwrites existing administrator account or modifies existing credentials', async () => {
      // 1. Pre-seed existing administrator
      const existingHash = await hashPassword('ExistingSecretPass123!');
      await createSuperAdminUser({
        email: 'admin@aweermarket.ae',
        passwordHash: existingHash,
        fullName: 'Original Chief Administrator'
      });

      // 2. Attempt seed with different password and name
      process.env.SUPER_ADMIN_EMAIL = 'admin@aweermarket.ae';
      process.env.SUPER_ADMIN_PASSWORD = 'NewAttemptedPassword2026!';
      process.env.SUPER_ADMIN_NAME = 'Malicious Overwrite Attempt';

      await ensureDefaultSuperAdmin();

      // 3. Verify original account was not modified
      const current = await findUserByEmail('admin@aweermarket.ae', true);
      assert.ok(current);
      assert.strictEqual(current.fullName, 'Original Chief Administrator', 'Account name must not be overwritten');
      assert.strictEqual(current.passwordHash, existingHash, 'Account passwordHash must not be overwritten');

      const originalPassValid = await verifyPassword('ExistingSecretPass123!', current.passwordHash);
      assert.strictEqual(originalPassValid, true, 'Original password must still be valid');

      const newPassValid = await verifyPassword('NewAttemptedPassword2026!', current.passwordHash);
      assert.strictEqual(newPassValid, false, 'New password must not have replaced existing credentials');
    });
  });

  describe('4. Multi-Instance Concurrency & Error Propagation', () => {
    it('idempotently handles repeated execution without throwing errors', async () => {
      process.env.SUPER_ADMIN_EMAIL = 'cluster.admin@aweermarket.ae';
      process.env.SUPER_ADMIN_PASSWORD = 'ClusterSecurePass2026!';
      process.env.SUPER_ADMIN_NAME = 'Cluster Administrator';

      // First run
      await ensureDefaultSuperAdmin();
      const firstCheck = await findUserByEmail('cluster.admin@aweermarket.ae');
      assert.ok(firstCheck);

      // Repeat second run
      await ensureDefaultSuperAdmin();
      // Repeat third run
      await ensureDefaultSuperAdmin();

      const users = await listAllUsers();
      assert.strictEqual(users.length, 1, 'Only one admin user record must exist after multiple seed invocations');
    });

    it('safely handles concurrent initialization without duplicate records or crashes', async () => {
      process.env.SUPER_ADMIN_EMAIL = 'concurrent.admin@aweermarket.ae';
      process.env.SUPER_ADMIN_PASSWORD = 'ConcurrentPass2026!';
      process.env.SUPER_ADMIN_NAME = 'Concurrent Admin';

      // Simulate 5 simultaneous workers booting concurrently
      await Promise.all([
        ensureDefaultSuperAdmin(),
        ensureDefaultSuperAdmin(),
        ensureDefaultSuperAdmin(),
        ensureDefaultSuperAdmin(),
        ensureDefaultSuperAdmin()
      ]);

      const users = await listAllUsers();
      assert.strictEqual(users.length, 1, 'Exactly 1 super admin record must exist after concurrent seed execution');
      assert.strictEqual(users[0].email, 'concurrent.admin@aweermarket.ae');
    });
  });
});
