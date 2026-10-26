import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { FastifyInstance } from 'fastify';
import { UserRole } from '@aweermarket/types';
import { buildServer } from './server.js';
import { hashPassword, signSessionToken } from './utils/crypto.js';
import { getSecretForRole } from './plugins/security.js';
import { UserModel, createSuperAdminUser, createBuyerUser, resetInMemoryUsers, simulateUserCollision } from './models/user.model.js';
import { resetInMemoryShops, findShopById, findShopBySlug, createShop, updateShop } from './models/shop.model.js';
import { resetInMemoryProducts } from './models/product.model.js';
import { resetInMemoryOrders } from './models/order.model.js';
import {
  ResellerModel,
  resetInMemoryResellers,
  setInMemoryResellerStoreAllowed,
  isInMemoryResellerStoreAllowed,
  DatabaseUnavailableError
} from './models/reseller.model.js';

describe('AweerMarket Super Admin — Reseller Persistence Safety & Integration Suite', () => {
  let server: FastifyInstance;
  let superAdminToken: string;
  let buyerToken: string;

  const originalReadyStateDesc =
    Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState') ||
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(mongoose.connection), 'readyState');

  function setMockReadyState(state: number) {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: state,
      configurable: true,
      writable: true
    });
  }

  function restoreMockReadyState() {
    if (originalReadyStateDesc) {
      Object.defineProperty(mongoose.connection, 'readyState', originalReadyStateDesc);
    } else {
      delete (mongoose.connection as any).readyState;
    }
  }

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    setInMemoryResellerStoreAllowed(false);
    resetInMemoryUsers();
    resetInMemoryShops();
    resetInMemoryProducts();
    resetInMemoryOrders();
    resetInMemoryResellers();

    server = await buildServer();
    await server.ready();

    // 1. Super Admin
    const superAdminHash = await hashPassword('SuperAdminPass123!');
    const superAdmin = await createSuperAdminUser({
      email: 'admin@aweermarket.ae',
      passwordHash: superAdminHash,
      fullName: 'Chief Market Officer'
    });
    superAdminToken = signSessionToken(
      {
        userId: superAdmin.id,
        role: UserRole.SUPER_ADMIN,
        email: superAdmin.email
      },
      getSecretForRole(UserRole.SUPER_ADMIN)
    );

    // 2. Buyer
    const buyerHash = await hashPassword('BuyerPassword123!');
    const buyer = await createBuyerUser({
      email: 'buyer@test.ae',
      passwordHash: buyerHash,
      fullName: 'Commercial Buyer'
    });
    buyerToken = signSessionToken(
      {
        userId: buyer.id,
        role: UserRole.BUYER,
        email: buyer.email
      },
      getSecretForRole(UserRole.BUYER)
    );
  });

  afterEach(async () => {
    restoreMockReadyState();
    setInMemoryResellerStoreAllowed(false);
    process.env.NODE_ENV = 'test';
    await server.close();
  });

  // ==========================================================================
  // Case 1: MongoDB connected: create a reseller successfully
  // ==========================================================================
  it('1. MongoDB connected: create a reseller successfully', async () => {
    setMockReadyState(1);

    const origUserFindById = UserModel.findById;
    (UserModel as any).findById = () => ({
      exec: async () => ({
        _id: 'superadmin_1',
        id: 'superadmin_1',
        email: 'admin@aweermarket.ae',
        role: UserRole.SUPER_ADMIN,
        isActive: true
      })
    });

    const origFindOne = ResellerModel.findOne;
    const origCreate = ResellerModel.create;

    (ResellerModel as any).findOne = async () => null;
    (ResellerModel as any).create = async (docData: any) => ({
      _id: new mongoose.Types.ObjectId(),
      ...docData,
      outstandingBalanceAed: 0,
      totalOrders: 0,
      totalSpentAed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      toItem() {
        return {
          id: this._id.toString(),
          businessName: this.businessName,
          contactPerson: this.contactPerson,
          email: this.email,
          phone: this.phone,
          tradeLicenseNumber: this.tradeLicenseNumber,
          tier: this.tier || 'bronze',
          discountPercent: this.discountPercent ?? 5,
          creditLimitAed: this.creditLimitAed ?? 10000,
          outstandingBalanceAed: 0,
          paymentTerms: this.paymentTerms || 'net_15',
          status: this.status || 'pending',
          totalOrders: 0,
          totalSpentAed: 0,
          notes: this.notes || '',
          createdAt: this.createdAt.toISOString(),
          updatedAt: this.updatedAt.toISOString()
        };
      }
    });

    try {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/admin/resellers',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          businessName: 'Persisted Wholesale Trading LLC',
          contactPerson: 'Ali Al Marri',
          email: 'ali@persistedwholesale.ae',
          phone: '+971501234567',
          tradeLicenseNumber: 'TL-DXB-55443',
          tier: 'silver',
          creditLimitAed: 25000,
          paymentTerms: 'net_30'
        }
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.reseller.businessName, 'Persisted Wholesale Trading LLC');
      assert.strictEqual(body.reseller.email, 'ali@persistedwholesale.ae');
      assert.ok(body.reseller.id);
    } finally {
      UserModel.findById = origUserFindById;
      ResellerModel.findOne = origFindOne;
      ResellerModel.create = origCreate;
    }
  });

  // ==========================================================================
  // Case 2: MongoDB disconnected: create fails; no success response
  // ==========================================================================
  it('2. MongoDB disconnected: create fails; no success response (fails closed with 503)', async () => {
    setMockReadyState(0);
    setInMemoryResellerStoreAllowed(false);

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/resellers',
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      },
      payload: {
        businessName: 'Disconnected Attempt LLC',
        contactPerson: 'Rashid',
        email: 'rashid@attempt.ae',
        phone: '+971509876543',
        tradeLicenseNumber: 'TL-DXB-99887'
      }
    });

    assert.strictEqual(res.statusCode, 503, 'Must reject with 503 Service Unavailable when DB is disconnected');
    assert.notStrictEqual(res.statusCode, 201, 'Must NEVER return 201 Created when DB is disconnected');
    assert.notStrictEqual(res.statusCode, 200, 'Must NEVER return 200 OK when DB is disconnected');

    const body = JSON.parse(res.payload);
    assert.strictEqual(body.error, 'Service Unavailable');
  });

  // ==========================================================================
  // Case 3: MongoDB disconnected: update fails
  // ==========================================================================
  it('3. MongoDB disconnected: update fails (fails closed with 503)', async () => {
    setMockReadyState(0);
    setInMemoryResellerStoreAllowed(false);

    const res = await server.inject({
      method: 'PUT',
      url: '/api/v1/admin/resellers/any_reseller_id',
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      },
      payload: {
        creditLimitAed: 50000,
        tier: 'gold'
      }
    });

    assert.strictEqual(res.statusCode, 503, 'Must reject update with 503 Service Unavailable when DB is disconnected');
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.error, 'Service Unavailable');
  });

  // ==========================================================================
  // Case 4: MongoDB disconnected: status change fails
  // ==========================================================================
  it('4. MongoDB disconnected: status change fails (fails closed with 503)', async () => {
    setMockReadyState(0);
    setInMemoryResellerStoreAllowed(false);

    const res = await server.inject({
      method: 'PATCH',
      url: '/api/v1/admin/resellers/any_reseller_id/status',
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      },
      payload: {
        status: 'approved'
      }
    });

    assert.strictEqual(res.statusCode, 503, 'Must reject status change with 503 when DB is disconnected');
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.error, 'Service Unavailable');
  });

  // ==========================================================================
  // Case 5: MongoDB disconnected: delete fails
  // ==========================================================================
  it('5. MongoDB disconnected: delete fails (fails closed with 503)', async () => {
    setMockReadyState(0);
    setInMemoryResellerStoreAllowed(false);

    const res = await server.inject({
      method: 'DELETE',
      url: '/api/v1/admin/resellers/any_reseller_id',
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      }
    });

    assert.strictEqual(res.statusCode, 503, 'Must reject delete with 503 when DB is disconnected');
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.error, 'Service Unavailable');
  });

  // ==========================================================================
  // Case 6: MongoDB unavailable: list/read does not silently present in-memory records
  // ==========================================================================
  it('6. MongoDB unavailable: list/read does not silently present in-memory records as persistent database data', async () => {
    setMockReadyState(0);
    setInMemoryResellerStoreAllowed(false);

    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/resellers',
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      }
    });

    assert.strictEqual(res.statusCode, 503, 'Must reject list with 503 when persistent storage is unavailable');
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.error, 'Service Unavailable');
    assert.strictEqual(body.resellers, undefined, 'Must not return fabricated or in-memory reseller list');
  });

  // ==========================================================================
  // Case 7: MongoDB write failure: API returns failure response (does not falsely report success)
  // ==========================================================================
  it('7. MongoDB write failure: API returns a failure response and does not falsely report success', async () => {
    setMockReadyState(1);

    const origUserFindById = UserModel.findById;
    (UserModel as any).findById = () => ({
      exec: async () => ({
        _id: 'superadmin_1',
        id: 'superadmin_1',
        email: 'admin@aweermarket.ae',
        role: UserRole.SUPER_ADMIN,
        isActive: true
      })
    });

    const origFindOne = ResellerModel.findOne;
    const origCreate = ResellerModel.create;

    (ResellerModel as any).findOne = async () => null;
    (ResellerModel as any).create = async () => {
      throw new Error('MongoNetworkWriteConcernError: connection lost during write transaction');
    };

    try {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/admin/resellers',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          businessName: 'Failing DB Write LLC',
          contactPerson: 'Mansoor',
          email: 'mansoor@failwrite.ae',
          phone: '+971501112233',
          tradeLicenseNumber: 'TL-FAIL-112'
        }
      });

      assert.strictEqual(res.statusCode, 503, 'Must return 503 Service Unavailable on MongoDB write failure');
      assert.notStrictEqual(res.statusCode, 201, 'Must never return 201 when MongoDB write fails');
      assert.notStrictEqual(res.statusCode, 200, 'Must never return 200 when MongoDB write fails');

      const body = JSON.parse(res.payload);
      assert.strictEqual(body.error, 'Service Unavailable');
    } finally {
      UserModel.findById = origUserFindById;
      ResellerModel.findOne = origFindOne;
      ResellerModel.create = origCreate;
    }
  });

  // ==========================================================================
  // Case 8: MongoDB reconnects: normal persistent operations work again
  // ==========================================================================
  it('8. MongoDB reconnects: normal persistent operations work again', async () => {
    // Stage A: Disconnected -> fails closed
    setMockReadyState(0);
    setInMemoryResellerStoreAllowed(false);

    const resDisconnected = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/resellers',
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      },
      payload: {
        businessName: 'Reconnect Test LLC',
        contactPerson: 'Hamdan',
        email: 'hamdan@reconnect.ae',
        phone: '+971503334455',
        tradeLicenseNumber: 'TL-REC-001'
      }
    });
    assert.strictEqual(resDisconnected.statusCode, 503, 'Step A: Must fail with 503 while disconnected');

    // Stage B: Reconnected -> succeeds
    setMockReadyState(1);

    const origUserFindById = UserModel.findById;
    (UserModel as any).findById = () => ({
      exec: async () => ({
        _id: 'superadmin_1',
        id: 'superadmin_1',
        email: 'admin@aweermarket.ae',
        role: UserRole.SUPER_ADMIN,
        isActive: true
      })
    });

    const origFindOne = ResellerModel.findOne;
    const origCreate = ResellerModel.create;

    (ResellerModel as any).findOne = async () => null;
    (ResellerModel as any).create = async (docData: any) => ({
      _id: new mongoose.Types.ObjectId(),
      ...docData,
      outstandingBalanceAed: 0,
      totalOrders: 0,
      totalSpentAed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      toItem() {
        return {
          id: this._id.toString(),
          businessName: this.businessName,
          contactPerson: this.contactPerson,
          email: this.email,
          phone: this.phone,
          tradeLicenseNumber: this.tradeLicenseNumber,
          tier: this.tier || 'bronze',
          discountPercent: 5,
          creditLimitAed: 10000,
          outstandingBalanceAed: 0,
          paymentTerms: 'net_15',
          status: 'pending',
          totalOrders: 0,
          totalSpentAed: 0,
          notes: '',
          createdAt: this.createdAt.toISOString(),
          updatedAt: this.updatedAt.toISOString()
        };
      }
    });

    try {
      const resReconnected = await server.inject({
        method: 'POST',
        url: '/api/v1/admin/resellers',
        headers: {
          cookie: `aweer_session=${superAdminToken}`
        },
        payload: {
          businessName: 'Reconnect Test LLC',
          contactPerson: 'Hamdan',
          email: 'hamdan@reconnect.ae',
          phone: '+971503334455',
          tradeLicenseNumber: 'TL-REC-001'
        }
      });

      assert.strictEqual(resReconnected.statusCode, 201, 'Step B: Must succeed with 201 after MongoDB reconnects');
      const body = JSON.parse(resReconnected.payload);
      assert.strictEqual(body.reseller.businessName, 'Reconnect Test LLC');
    } finally {
      UserModel.findById = origUserFindById;
      ResellerModel.findOne = origFindOne;
      ResellerModel.create = origCreate;
    }
  });

  // ==========================================================================
  // Case 9: Authentication and Super Admin authorization remain enforced
  // ==========================================================================
  it('9. Authentication and Super Admin authorization remain enforced', async () => {
    // 9a. REJECTS unauthenticated access with 401
    const unauthRes = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/resellers'
    });
    assert.strictEqual(unauthRes.statusCode, 401);

    // 9b. REJECTS buyer access with 403 Forbidden
    const buyerRes = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/resellers',
      headers: {
        cookie: `aweer_session=${buyerToken}`
      }
    });
    assert.strictEqual(buyerRes.statusCode, 403);
  });

  // ==========================================================================
  // Case 10: Duplicate email and outstanding-balance deletion protections still work
  // ==========================================================================
  it('10. Duplicate email and outstanding-balance deletion protections still work', async () => {
    // Enable explicit in-memory store for isolated business logic validation
    setInMemoryResellerStoreAllowed(true);

    // 10a. Duplicate email conflict (409)
    const dupRes = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/resellers',
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      },
      payload: {
        businessName: 'Duplicate Test',
        contactPerson: 'Sultan',
        email: 'sultan@gulffresh.ae', // Existing default seed email
        phone: '+971501112233',
        tradeLicenseNumber: 'TL-DXB-99999'
      }
    });
    assert.strictEqual(dupRes.statusCode, 409);
    const dupBody = JSON.parse(dupRes.payload);
    assert.match(dupBody.message, /already exists/i);

    // 10b. Deletion blocked for reseller with outstanding balance (400)
    const listRes = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/resellers',
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      }
    });
    const list = JSON.parse(listRes.payload).resellers;
    const indebtedReseller = list.find((r: any) => r.outstandingBalanceAed > 0);
    assert.ok(indebtedReseller, 'Must have a seed reseller with positive outstanding balance');

    const delRes = await server.inject({
      method: 'DELETE',
      url: `/api/v1/admin/resellers/${indebtedReseller.id}`,
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      }
    });
    assert.strictEqual(delRes.statusCode, 400);
    const delBody = JSON.parse(delRes.payload);
    assert.match(delBody.message, /outstanding credit balance/i);
  });

  // ==========================================================================
  // Case 11: Existing isolated tests remain reliable without permitting production fallback
  // ==========================================================================
  it('11. Existing isolated tests remain reliable without permitting production fallback', async () => {
    // 11a. In production, in-memory store CANNOT be enabled
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => setInMemoryResellerStoreAllowed(true),
      (err: any) => err instanceof DatabaseUnavailableError || err.statusCode === 503
    );
    assert.strictEqual(isInMemoryResellerStoreAllowed(), false, 'Must strictly return false in production');

    // 11b. In test mode, isolated test suite functions correctly when explicitly allowed
    process.env.NODE_ENV = 'test';
    setInMemoryResellerStoreAllowed(true);
    assert.strictEqual(isInMemoryResellerStoreAllowed(), true);

    // List all
    const listRes = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/resellers',
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      }
    });
    assert.strictEqual(listRes.statusCode, 200);
    const list = JSON.parse(listRes.payload).resellers;
    assert.ok(list.length >= 3);

    // Create
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/resellers',
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      },
      payload: {
        businessName: 'Isolated Test Merchant LLC',
        contactPerson: 'Adnan',
        email: 'adnan@isolatedtest.ae',
        phone: '+971501119988',
        tradeLicenseNumber: 'TL-ISO-001',
        tier: 'silver',
        creditLimitAed: 20000,
        paymentTerms: 'net_30'
      }
    });
    assert.strictEqual(createRes.statusCode, 201);
    const createdId = JSON.parse(createRes.payload).reseller.id;

    // Update
    const updateRes = await server.inject({
      method: 'PUT',
      url: `/api/v1/admin/resellers/${createdId}`,
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      },
      payload: {
        creditLimitAed: 35000,
        tier: 'gold'
      }
    });
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(JSON.parse(updateRes.payload).reseller.creditLimitAed, 35000);

    // Status change
    const patchRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/admin/resellers/${createdId}/status`,
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      },
      payload: {
        status: 'approved'
      }
    });
    assert.strictEqual(patchRes.statusCode, 200);
    assert.strictEqual(JSON.parse(patchRes.payload).reseller.status, 'approved');

    // Delete zero-balance reseller
    const delRes = await server.inject({
      method: 'DELETE',
      url: `/api/v1/admin/resellers/${createdId}`,
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      }
    });
    assert.strictEqual(delRes.statusCode, 200);
  });

  it('12. Reseller Admin Provisioning, Multi-Tenant Stall Governance, and Isolation', async () => {
    setInMemoryResellerStoreAllowed(true);

    // 1. Super Admin registers Reseller with a direct password
    const resellerPayload = {
      businessName: 'Apex Produce Wholesale LLC',
      contactPerson: 'Apex Partner Admin',
      email: 'partner@apexwholesale.ae',
      password: 'ApexSecretPass2026!',
      phone: '+971 50 111 2222',
      tradeLicenseNumber: 'TL-APEX-001',
      tier: 'gold',
      creditLimitAed: 100000
    };

    const regRes = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/resellers',
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      },
      payload: resellerPayload
    });
    assert.strictEqual(regRes.statusCode, 201);
    const resellerData = JSON.parse(regRes.payload).reseller;

    // 2. Reseller logs into the administration portal with their provisioned credentials
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/super-admin/login',
      payload: {
        email: resellerPayload.email,
        password: resellerPayload.password
      }
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.payload);
    assert.strictEqual(loginBody.user.role, UserRole.RESELLER);
    assert.strictEqual(loginBody.user.resellerId, resellerData.id);

    // Extract reseller session cookie
    const setCookie = loginRes.headers['set-cookie'];
    assert.ok(setCookie);
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    const match = cookieHeader.match(/aweer_session=([^;]+)/);
    assert.ok(match);
    const resellerToken = match[1];

    // 3. Security Restriction: Reseller CANNOT access /admin/resellers
    const forbiddenRes = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/resellers',
      headers: {
        cookie: `aweer_session=${resellerToken}`
      }
    });
    assert.strictEqual(forbiddenRes.statusCode, 403);
    assert.strictEqual(JSON.parse(forbiddenRes.payload).error, 'Forbidden');

    // 4. Reseller CAN create a wholesale vendor stall with a password
    const shopPayload = {
      name: 'Al Aweer Berry Hub',
      stallNumber: 'Stall D-42',
      ownerName: 'Rashid Al Shamsi',
      email: 'rashid@berryhub.ae',
      password: 'BerryHubVendorPass2026!',
      phone: '+971 50 333 4444',
      tradeLicenseNumber: 'TL-DXB-BERRY-42'
    };

    const createShopRes = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/shops',
      headers: {
        cookie: `aweer_session=${resellerToken}`
      },
      payload: shopPayload
    });
    assert.strictEqual(createShopRes.statusCode, 201);
    const createdShop = JSON.parse(createShopRes.payload).shop;
    assert.strictEqual(createdShop.resellerId, resellerData.id);

    // 5. Newly created vendor can immediately log into the vendor portal
    const vendorLoginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/vendor/login',
      payload: {
        email: shopPayload.email,
        password: shopPayload.password
      }
    });
    assert.strictEqual(vendorLoginRes.statusCode, 200);
    const vendorLoginBody = JSON.parse(vendorLoginRes.payload);
    assert.strictEqual(vendorLoginBody.user.email, shopPayload.email);
    assert.strictEqual(vendorLoginBody.shop.id, createdShop.id);

    // 6. Reseller can manage their own stall
    const patchApproveRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/admin/shops/${createdShop.id}/status`,
      headers: {
        cookie: `aweer_session=${resellerToken}`
      },
      payload: { isActive: false }
    });
    assert.strictEqual(patchApproveRes.statusCode, 200);
    assert.strictEqual(JSON.parse(patchApproveRes.payload).shop.isActive, false);

    // 7. Multi-Tenant Isolation: Another reseller cannot manage this stall
    // Create second reseller
    const regRes2 = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/resellers',
      headers: {
        cookie: `aweer_session=${superAdminToken}`
      },
      payload: {
        businessName: 'Rival Wholesale Trading LLC',
        contactPerson: 'Rival Admin',
        email: 'rival@rivaltrading.ae',
        password: 'RivalSecurePass2026!',
        phone: '+971 50 999 8888',
        tradeLicenseNumber: 'TL-RIVAL-002'
      }
    });
    assert.strictEqual(regRes2.statusCode, 201);

    const loginRes2 = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/super-admin/login',
      payload: {
        email: 'rival@rivaltrading.ae',
        password: 'RivalSecurePass2026!'
      }
    });
    const setCookie2 = loginRes2.headers['set-cookie'];
    assert.ok(setCookie2);
    const cookieHeader2 = Array.isArray(setCookie2) ? setCookie2[0] : setCookie2;
    assert.ok(cookieHeader2);
    const match2 = cookieHeader2.match(/aweer_session=([^;]+)/);
    assert.ok(match2);
    const rivalResellerToken = match2[1];

    // Rival tries to modify Apex's stall -> MUST BE 403 FORBIDDEN
    const rivalForbiddenPatch = await server.inject({
      method: 'PATCH',
      url: `/api/v1/admin/shops/${createdShop.id}/status`,
      headers: {
        cookie: `aweer_session=${rivalResellerToken}`
      },
      payload: { isActive: true }
    });
    assert.strictEqual(rivalForbiddenPatch.statusCode, 403);
    assert.strictEqual(JSON.parse(rivalForbiddenPatch.payload).error, 'Forbidden');
  });

  // ==========================================================================
  // Case 13: Reseller Overview Metrics Isolation vs Super Admin Global Access
  // ==========================================================================
  it('13. Reseller Overview Metrics Isolation vs Super Admin Global Access', async () => {
    setInMemoryResellerStoreAllowed(true);

    // Provision Reseller Alpha
    const regResA = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/resellers',
      headers: { cookie: `aweer_session=${superAdminToken}` },
      payload: {
        businessName: 'Reseller Alpha LLC',
        contactPerson: 'Alpha Admin',
        email: 'alpha@reseller.ae',
        password: 'AlphaPassword123!',
        phone: '+971501110001',
        tradeLicenseNumber: 'TL-ALPHA-01'
      }
    });
    assert.strictEqual(regResA.statusCode, 201);

    // Login as Reseller Alpha
    const loginA = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/super-admin/login',
      payload: { email: 'alpha@reseller.ae', password: 'AlphaPassword123!' }
    });
    const setCookieA = loginA.headers['set-cookie'];
    assert.ok(setCookieA);
    const cookieHeaderA = Array.isArray(setCookieA) ? setCookieA[0] : setCookieA;
    assert.ok(cookieHeaderA);
    const matchA = cookieHeaderA.match(/aweer_session=([^;]+)/);
    assert.ok(matchA);
    const tokenA = matchA[1];

    // Reseller Alpha creates 2 stalls
    for (let i = 1; i <= 2; i++) {
      const shopRes = await server.inject({
        method: 'POST',
        url: '/api/v1/admin/shops',
        headers: { cookie: `aweer_session=${tokenA}` },
        payload: {
          name: `Alpha Stall ${i}`,
          stallNumber: `A-0${i}`,
          ownerName: `Vendor A${i}`,
          email: `vendor_a${i}@alpha.ae`,
          password: 'VendorPassword123!',
          phone: `+97150000000${i}`
        }
      });
      assert.strictEqual(shopRes.statusCode, 201);
    }

    // Super Admin creates a direct stall (not belonging to Reseller Alpha)
    const shopAdminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/shops',
      headers: { cookie: `aweer_session=${superAdminToken}` },
      payload: {
        name: 'Direct Admin Stall',
        stallNumber: 'DIR-01',
        ownerName: 'Direct Vendor',
        email: 'vendor_direct@aweer.ae',
        password: 'VendorPassword123!',
        phone: '+971509999999'
      }
    });
    assert.strictEqual(shopAdminRes.statusCode, 201);

    // Reseller Alpha requests GET /api/v1/admin/overview
    const overviewResA = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/overview',
      headers: { cookie: `aweer_session=${tokenA}` }
    });
    assert.strictEqual(overviewResA.statusCode, 200);
    const metricsA = JSON.parse(overviewResA.payload).metrics;

    // Reseller Alpha must see only their own 2 shops, 0 resellers, and 0 global buyers
    assert.strictEqual(metricsA.totalShops, 2);
    assert.strictEqual(metricsA.approvedShops, 2);
    assert.strictEqual(metricsA.totalResellers, 0, 'Reseller cannot see other resellers count');
    assert.strictEqual(metricsA.buyers, 0, 'Reseller must not see platform-wide buyers');
    assert.strictEqual(metricsA.shopAdmins, 2, 'Reseller sees only their own shop admins');

    // Super Admin requests GET /api/v1/admin/overview -> sees platform-wide stalls & resellers
    const overviewResSA = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/overview',
      headers: { cookie: `aweer_session=${superAdminToken}` }
    });
    assert.strictEqual(overviewResSA.statusCode, 200);
    const metricsSA = JSON.parse(overviewResSA.payload).metrics;
    assert.strictEqual(metricsSA.totalShops, 3, 'Super Admin sees platform-wide stalls');
    assert.ok(metricsSA.totalResellers >= 1, 'Super Admin sees platform-wide resellers');
  });

  // ==========================================================================
  // Case 14: Secure Shop Metadata Editing (PUT /api/v1/admin/shops/:id)
  // ==========================================================================
  it('14. Secure Shop Metadata Editing (PUT /api/v1/admin/shops/:id) and Tenant Isolation', async () => {
    setInMemoryResellerStoreAllowed(true);

    // 1. Super Admin registers Reseller Apex
    const regRes = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/resellers',
      headers: { cookie: `aweer_session=${superAdminToken}` },
      payload: {
        businessName: 'Apex Grocers LLC',
        contactPerson: 'Apex Manager',
        email: 'mgr@apexgrocers.ae',
        password: 'ApexSecretPass123!',
        phone: '+971501234567',
        tradeLicenseNumber: 'TL-APEX-099'
      }
    });
    assert.strictEqual(regRes.statusCode, 201);

    // Reseller Apex logs in
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/super-admin/login',
      payload: { email: 'mgr@apexgrocers.ae', password: 'ApexSecretPass123!' }
    });
    const setCookieApex = loginRes.headers['set-cookie'];
    assert.ok(setCookieApex);
    const cookieHeaderApex = Array.isArray(setCookieApex) ? setCookieApex[0] : setCookieApex;
    assert.ok(cookieHeaderApex);
    const matchApex = cookieHeaderApex.match(/aweer_session=([^;]+)/);
    assert.ok(matchApex);
    const apexToken = matchApex[1];

    // Apex creates a stall
    const stallRes = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/shops',
      headers: { cookie: `aweer_session=${apexToken}` },
      payload: {
        name: 'Apex Veg Stall',
        stallNumber: 'AV-10',
        ownerName: 'Apex Vendor 1',
        email: 'stall1@apexgrocers.ae',
        password: 'Password123!',
        phone: '+971501112233'
      }
    });
    assert.strictEqual(stallRes.statusCode, 201);
    const stall = JSON.parse(stallRes.payload).shop;

    // 2. Apex edits their own stall metadata
    const editRes = await server.inject({
      method: 'PUT',
      url: `/api/v1/admin/shops/${stall.id}`,
      headers: { cookie: `aweer_session=${apexToken}` },
      payload: {
        name: 'Apex Premium Veg Stall',
        stallNumber: 'AV-10-REVISED',
        phone: '+971509990000',
        description: 'Updated premium organic vegetables dock',
        marketLocation: 'Block B Central Market'
      }
    });
    assert.strictEqual(editRes.statusCode, 200);
    const updatedStall = JSON.parse(editRes.payload).shop;
    assert.strictEqual(updatedStall.name, 'Apex Premium Veg Stall');
    assert.strictEqual(updatedStall.stallNumber, 'AV-10-REVISED');

    // 3. Register Rival Reseller
    await server.inject({
      method: 'POST',
      url: '/api/v1/admin/resellers',
      headers: { cookie: `aweer_session=${superAdminToken}` },
      payload: {
        businessName: 'Beta Trading LLC',
        contactPerson: 'Beta Manager',
        email: 'mgr@betatrading.ae',
        password: 'BetaSecretPass123!',
        phone: '+971508887766',
        tradeLicenseNumber: 'TL-BETA-099'
      }
    });
    const loginBeta = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/super-admin/login',
      payload: { email: 'mgr@betatrading.ae', password: 'BetaSecretPass123!' }
    });
    const setCookieBeta = loginBeta.headers['set-cookie'];
    assert.ok(setCookieBeta);
    const cookieHeaderBeta = Array.isArray(setCookieBeta) ? setCookieBeta[0] : setCookieBeta;
    assert.ok(cookieHeaderBeta);
    const matchBeta = cookieHeaderBeta.match(/aweer_session=([^;]+)/);
    assert.ok(matchBeta);
    const betaToken = matchBeta[1];

    // Rival attempts to edit Apex's stall -> MUST BE 403 FORBIDDEN
    const rivalEditRes = await server.inject({
      method: 'PUT',
      url: `/api/v1/admin/shops/${stall.id}`,
      headers: { cookie: `aweer_session=${betaToken}` },
      payload: {
        name: 'Hacked Stall Name'
      }
    });
    assert.strictEqual(rivalEditRes.statusCode, 403);
    assert.strictEqual(JSON.parse(rivalEditRes.payload).error, 'Forbidden');

    // 4. Super Admin can edit any stall
    const saEditRes = await server.inject({
      method: 'PUT',
      url: `/api/v1/admin/shops/${stall.id}`,
      headers: { cookie: `aweer_session=${superAdminToken}` },
      payload: {
        description: 'Super Admin compliance audited description'
      }
    });
    assert.strictEqual(saEditRes.statusCode, 200);

    // 5. Protected fields cannot be injected or modified via metadata PUT
    const injectRes = await server.inject({
      method: 'PUT',
      url: `/api/v1/admin/shops/${stall.id}`,
      headers: { cookie: `aweer_session=${apexToken}` },
      payload: {
        ownerId: 'injected_owner_id',
        resellerId: 'injected_reseller_id'
      } as any
    });
    assert.strictEqual(injectRes.statusCode, 400, 'Zod strict schema rejects unknown protected keys');
  });

  // ==========================================================================
  // Case 15: Atomic Rollback on Registration Failure
  // ==========================================================================
  it('15. Atomic Rollback of Orphaned Shop on Vendor User Creation Failure', async () => {
    setInMemoryResellerStoreAllowed(true);

    // 1. Create a buyer user first
    const existingBuyerEmail = 'registered_buyer@aweermarket.ae';
    const pwHash = await hashPassword('BuyerSecurePassword123!');
    await createBuyerUser({
      fullName: 'Existing Customer',
      email: existingBuyerEmail,
      passwordHash: pwHash,
      phone: '+971501112299'
    });

    // 2. Attempt to register a stall with this duplicate email
    // Pre-validation findUserByEmail rejects it with 409
    const dupRes = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/shops',
      headers: { cookie: `aweer_session=${superAdminToken}` },
      payload: {
        name: 'Attempted Duplicate Stall',
        stallNumber: 'ST-DUP-01',
        ownerName: 'Dup Owner',
        email: existingBuyerEmail,
        password: 'ValidPassword123!',
        phone: '+971508889900'
      }
    });
    assert.strictEqual(dupRes.statusCode, 409);
    assert.strictEqual(await findShopBySlug('attempted-duplicate-stall'), null, 'No shop created on 409 email conflict');

    // 3. Test compensating rollback when user creation fails post-shop-creation:
    const testStallName = 'Rollback Validation Produce LLC';
    const testSlug = 'rollback-validation-produce-llc';
    const crashEmail = 'crash_test@aweermarket.ae';

    // Verify stall does not exist beforehand
    assert.strictEqual(await findShopBySlug(testSlug), null);

    // Simulate mid-flight email collision where pre-check passed but insert collided:
    simulateUserCollision(crashEmail);

    const failedRes = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/shops',
      headers: { cookie: `aweer_session=${superAdminToken}` },
      payload: {
        name: testStallName,
        stallNumber: 'ST-CRASH-01',
        ownerName: 'Crash Owner',
        email: crashEmail,
        password: 'ValidPassword123!',
        phone: '+971507776655'
      }
    });
    // Original error is reported
    assert.strictEqual(failedRes.statusCode, 409);

    // CRITICAL ASSERTION: The orphaned shop created before failure MUST BE DELETED
    const orphanedShop = await findShopBySlug(testSlug);
    assert.strictEqual(orphanedShop, null, 'Orphaned shop record must be cleanly rolled back and deleted');
  });

  // ==========================================================================
  // Case 16: Preserved Super Admin Global Access
  // ==========================================================================
  it('16. Preserved Super Admin Global Access and Unfiltered Oversight', async () => {
    setInMemoryResellerStoreAllowed(true);

    const overviewRes = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/overview',
      headers: { cookie: `aweer_session=${superAdminToken}` }
    });
    assert.strictEqual(overviewRes.statusCode, 200);

    const shopsRes = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/shops',
      headers: { cookie: `aweer_session=${superAdminToken}` }
    });
    assert.strictEqual(shopsRes.statusCode, 200);

    const resellersRes = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/resellers',
      headers: { cookie: `aweer_session=${superAdminToken}` }
    });
    assert.strictEqual(resellersRes.statusCode, 200);

    const ordersRes = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/orders',
      headers: { cookie: `aweer_session=${superAdminToken}` }
    });
    assert.strictEqual(ordersRes.statusCode, 200);
  });

  // ==========================================================================
  // Case 17: updateShop persists ownerId and new vendor resolves associated shop
  // ==========================================================================
  it('17. updateShop persists ownerId and newly created vendor resolves associated shop', async () => {
    setInMemoryResellerStoreAllowed(true);

    // 1. Direct unit check: updateShop updates ownerId
    const shopToUpdate = await createShop({
      name: 'Owner Update Test Stall',
      stallNumber: 'ST-OWN-01',
      ownerId: 'temp_owner_before_update',
      tradeLicenseNumber: 'TL-OWN-001',
      phone: '+971501112233',
      isApproved: true,
      isActive: true
    });
    assert.strictEqual(shopToUpdate.ownerId, 'temp_owner_before_update');

    const updatedShopDirect = await updateShop(shopToUpdate.id, { ownerId: 'verified_authoritative_owner_id' });
    assert.ok(updatedShopDirect);
    assert.strictEqual(updatedShopDirect.ownerId, 'verified_authoritative_owner_id');

    // 2. Integration check: Admin creates vendor, and vendor logs in & resolves shop
    const vendorEmail = 'new_vendor_stall@aweermarket.ae';
    const vendorPassword = 'VendorPassword123!';

    const createVendorRes = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/shops',
      headers: { cookie: `aweer_session=${superAdminToken}` },
      payload: {
        name: 'Fresh Fruits Stall 42',
        stallNumber: 'Block C, Stall 42',
        ownerName: 'Rashid Stall Master',
        email: vendorEmail,
        password: vendorPassword,
        phone: '+971509991122',
        tradeLicenseNumber: 'TL-9991122'
      }
    });
    assert.strictEqual(createVendorRes.statusCode, 201);
    const createdShopData = JSON.parse(createVendorRes.payload).shop;
    const createdVendorData = JSON.parse(createVendorRes.payload).vendor;

    // Verify in storage that shop.ownerId matches createdVendorData.id
    const persistedShop = await findShopById(createdShopData.id);
    assert.ok(persistedShop);
    assert.strictEqual(persistedShop.ownerId, createdVendorData.id);

    // 3. Newly created vendor logs in to vendor portal
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/vendor/login',
      payload: {
        email: vendorEmail,
        password: vendorPassword
      }
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const vendorCookie = loginRes.headers['set-cookie'];
    assert.ok(vendorCookie);

    // 4. Vendor accesses GET /api/v1/vendor/shop
    const vendorShopRes = await server.inject({
      method: 'GET',
      url: '/api/v1/vendor/shop',
      headers: { cookie: vendorCookie }
    });
    assert.strictEqual(vendorShopRes.statusCode, 200);
    const resolvedShop = JSON.parse(vendorShopRes.payload).shop;
    assert.strictEqual(resolvedShop.id, createdShopData.id);
    assert.strictEqual(resolvedShop.name, 'Fresh Fruits Stall 42');

    // 5. Vendor accesses GET /api/v1/vendor/products (resolves shop successfully without 404)
    const vendorProductsRes = await server.inject({
      method: 'GET',
      url: '/api/v1/vendor/products',
      headers: { cookie: vendorCookie }
    });
    assert.strictEqual(vendorProductsRes.statusCode, 200);
    const productsPayload = JSON.parse(vendorProductsRes.payload);
    assert.ok(Array.isArray(productsPayload.products));
  });
});
