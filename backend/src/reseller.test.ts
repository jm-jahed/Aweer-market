import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { FastifyInstance } from 'fastify';
import { UserRole } from '@aweermarket/types';
import { buildServer } from './server.js';
import { hashPassword, signSessionToken } from './utils/crypto.js';
import { getSecretForRole } from './plugins/security.js';
import { UserModel, createSuperAdminUser, createBuyerUser, resetInMemoryUsers } from './models/user.model.js';
import { resetInMemoryShops } from './models/shop.model.js';
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
});
