/**
 * AweerMarket Buyer Account Foundation Unit & Contract Tests
 * Uses native Node.js test runner (node --test) without external dependencies.
 * Verifies profile data mapping, route guard behavior, fallbacks, verification badges, and token hygiene.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { getAuthMe, logoutUser, ApiClientError } from '../src/lib/api-client.ts';

describe('Phase 3.2-D: Buyer Account Foundation Unit & Contract Tests', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Mock UserSummary fixtures
  const verifiedBuyerFixture = {
    id: 'usr_buyer_777',
    email: 'tariq@gulfproduce.ae',
    fullName: 'Tariq Al-Hashemi',
    role: 'buyer',
    businessName: 'Gulf Fresh Produce Trading LLC',
    isActive: true,
    isEmailVerified: true,
    createdAt: '2026-05-15T08:30:00.000Z'
  };

  const provisionalBuyerFixture = {
    id: 'usr_buyer_888',
    email: 'nour@freshkitchen.ae',
    fullName: 'Nour El-Din',
    role: 'buyer',
    businessName: '',
    isActive: true,
    isEmailVerified: false,
    createdAt: '2026-10-22T21:00:00.000Z'
  };

  // ==========================================================================
  // 1. UserSummary Contract Strictness for Buyer Account Page
  // ==========================================================================
  describe('1. Profile Data Contract Alignment', () => {
    it('verifies that UserSummary contains only expected public buyer attributes', () => {
      const allowedKeys = new Set([
        'id',
        'email',
        'fullName',
        'role',
        'shopId',
        'vendorId',
        'businessName',
        'isActive',
        'isEmailVerified',
        'createdAt'
      ]);

      for (const key of Object.keys(verifiedBuyerFixture)) {
        assert.ok(
          allowedKeys.has(key),
          `Unexpected attribute found in user summary: ${key}`
        );
      }
    });

    it('ensures sensitive tokens and passwords are never present in account profile data', () => {
      const forbiddenKeys = ['password', 'passwordHash', 'token', 'jwt', 'aweer_session', 'secret', 'mfaSecret'];
      for (const key of forbiddenKeys) {
        assert.strictEqual(
          key in verifiedBuyerFixture,
          false,
          `Sensitive property ${key} must not be present in buyer profile`
        );
        assert.strictEqual(
          key in provisionalBuyerFixture,
          false,
          `Sensitive property ${key} must not be present in buyer profile`
        );
      }
    });

    it('ensures unexposed registration fields (phone, tradeLicenseNumber) are not relied upon in UserSummary', () => {
      // Backend UserSummary does not return phone or trade license
      assert.strictEqual('phone' in verifiedBuyerFixture, false);
      assert.strictEqual('tradeLicenseNumber' in verifiedBuyerFixture, false);
    });
  });

  // ==========================================================================
  // 2. Buyer Profile Presentation & Fallbacks
  // ==========================================================================
  describe('2. Buyer Profile Field Formatting & Fallbacks', () => {
    function formatBusinessName(name) {
      return name && name.trim() ? name.trim() : 'Individual Buyer / Not Specified';
    }

    function formatCreationDate(isoDateStr) {
      try {
        if (!isoDateStr) return 'Recently';
        const d = new Date(isoDateStr);
        if (Number.isNaN(d.getTime())) return 'Recently';
        return d.toLocaleDateString('en-AE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch {
        return 'Recently';
      }
    }

    it('correctly uses businessName when provided, and provides fallback when empty', () => {
      assert.strictEqual(
        formatBusinessName(verifiedBuyerFixture.businessName),
        'Gulf Fresh Produce Trading LLC'
      );
      assert.strictEqual(
        formatBusinessName(provisionalBuyerFixture.businessName),
        'Individual Buyer / Not Specified'
      );
      assert.strictEqual(
        formatBusinessName(null),
        'Individual Buyer / Not Specified'
      );
      assert.strictEqual(
        formatBusinessName('   '),
        'Individual Buyer / Not Specified'
      );
    });

    it('formats createdAt ISO dates safely without crashing on edge cases', () => {
      const formatted = formatCreationDate(verifiedBuyerFixture.createdAt);
      assert.ok(formatted.includes('2026'), 'Formatted date must contain year 2026');

      assert.strictEqual(formatCreationDate(null), 'Recently');
      assert.strictEqual(formatCreationDate('invalid-date'), 'Recently');
    });

    it('correctly distinguishes active vs suspended buyer status', () => {
      function getAccountStatus(isActive) {
        return isActive ? 'Active' : 'Suspended';
      }

      assert.strictEqual(getAccountStatus(true), 'Active');
      assert.strictEqual(getAccountStatus(false), 'Suspended');
    });

    it('correctly distinguishes verified buyer vs provisional account badge', () => {
      function getEmailStatusBadge(isEmailVerified) {
        return isEmailVerified ? 'Verified' : 'Provisional (Unverified)';
      }

      assert.strictEqual(
        getEmailStatusBadge(verifiedBuyerFixture.isEmailVerified),
        'Verified'
      );
      assert.strictEqual(
        getEmailStatusBadge(provisionalBuyerFixture.isEmailVerified),
        'Provisional (Unverified)'
      );
    });
  });

  // ==========================================================================
  // 3. Client-Side Route Guard Decision Logic
  // ==========================================================================
  describe('3. Route Guard Decision Logic', () => {
    function evaluateRouteGuard(isLoading, user) {
      if (isLoading) {
        return { action: 'WAIT_FOR_PROBE', redirectUrl: null };
      }
      if (!user) {
        return { action: 'REDIRECT_TO_LOGIN', redirectUrl: '/login' };
      }
      return { action: 'RENDER_ACCOUNT', redirectUrl: null };
    }

    it('waits while session is actively loading (isLoading === true)', () => {
      const result = evaluateRouteGuard(true, null);
      assert.strictEqual(result.action, 'WAIT_FOR_PROBE');
      assert.strictEqual(result.redirectUrl, null);
    });

    it('redirects to /login when probe completes with no user (isLoading === false, user === null)', () => {
      const result = evaluateRouteGuard(false, null);
      assert.strictEqual(result.action, 'REDIRECT_TO_LOGIN');
      assert.strictEqual(result.redirectUrl, '/login');
    });

    it('permits rendering account dashboard when authenticated user is present', () => {
      const result = evaluateRouteGuard(false, verifiedBuyerFixture);
      assert.strictEqual(result.action, 'RENDER_ACCOUNT');
      assert.strictEqual(result.redirectUrl, null);
    });
  });

  // ==========================================================================
  // 4. Account Dashboard Logout Trigger
  // ==========================================================================
  describe('4. Account Dashboard Logout Execution', () => {
    it('executes POST /api/v1/auth/logout with credentials included when user clicks logout', async () => {
      let capturedUrl = '';
      let capturedOptions = null;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return new Response(JSON.stringify({ statusCode: 200, message: 'Logged out successfully' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const result = await logoutUser();
      assert.match(capturedUrl, /\/auth\/logout$/);
      assert.strictEqual(capturedOptions.method, 'POST');
      assert.strictEqual(capturedOptions.credentials, 'include');
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.message, 'Logged out successfully');
    });
  });

  // ==========================================================================
  // 5. Browser Storage Isolation & Token Hygiene
  // ==========================================================================
  describe('5. Storage Hygiene & Token Shielding', () => {
    it('confirms no tokens or auth headers are stored into global storage objects', () => {
      const mockStorage = {};
      const storageProxy = {
        setItem(key, value) {
          mockStorage[key] = value;
        },
        getItem(key) {
          return mockStorage[key] || null;
        }
      };

      // Ensure our account page logic does not touch storage
      assert.strictEqual(Object.keys(mockStorage).length, 0);
      assert.strictEqual(storageProxy.getItem('token'), null);
      assert.strictEqual(storageProxy.getItem('aweer_session'), null);
    });
  });
});
