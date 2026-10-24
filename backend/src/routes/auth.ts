import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { RegisterBuyerSchema, RegisterVendorSchema, LoginSchema, ShopAdminLoginSchema, SuperAdminLoginSchema } from '@aweermarket/validation';
import { UserRole } from '@aweermarket/types';
import { hashPassword, verifyPassword, signSessionToken, verifySessionToken } from '../utils/crypto.js';
import { getSecretForRole, authenticate } from '../plugins/security.js';
import { rateLimitLogin, rateLimitRegister } from '../plugins/rate-limit.js';
import { serializeSessionCookie, parseCookie, SESSION_COOKIE_NAME } from '../utils/cookie.js';
import {
  findUserByEmail,
  findUserById,
  createBuyerUser,
  createShopAdminUser,
  incrementUserTokenVersion,
  DatabaseUnavailableError
} from '../models/user.model.js';
import {
  createShop,
  findShopById,
  findShopByOwnerId
} from '../models/shop.model.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/v1/auth/register
   * Registers a provisional buyer account and sets HTTP-only session cookie.
   */
  fastify.post('/register', { preHandler: [rateLimitRegister] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = RegisterBuyerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors.map((e) => e.message).join('; ')
      });
    }

    const { email, password, fullName, phone, businessName, tradeLicenseNumber } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing account with this email
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'An account with this email already exists'
      });
    }

    // Hash password with defensive scrypt utility
    const passwordHash = await hashPassword(password);

    let newUser;
    try {
      // Server strictly enforces UserRole.BUYER and provisional email verification status
      newUser = await createBuyerUser({
        email: normalizedEmail,
        passwordHash,
        fullName,
        phone,
        businessName,
        tradeLicenseNumber
      });
    } catch (err: unknown) {
      // Handle concurrent race duplicate key error
      if ((err as { code?: number })?.code === 11000) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'An account with this email already exists'
        });
      }
      throw err;
    }

    // Sign role-bound buyer session token
    const token = signSessionToken(
      {
        userId: newUser.id,
        role: UserRole.BUYER,
        email: newUser.email,
        tokenVersion: newUser.tokenVersion ?? 0
      },
      getSecretForRole(UserRole.BUYER)
    );

    // Set secure HTTP-only session cookie
    reply.header('Set-Cookie', serializeSessionCookie(token));

    return reply.status(201).send({
      statusCode: 201,
      message: 'Buyer registration successful',
      user: newUser.toUserSummary()
    });
  });

  /**
   * POST /api/v1/auth/login
   * Authenticates buyer credentials, verifies active status, and sets HTTP-only session cookie.
   */
  fastify.post('/login', { preHandler: [rateLimitLogin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = LoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors.map((e) => e.message).join('; ')
      });
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Retrieve user including stored password hash
    const user = await findUserByEmail(normalizedEmail, true);
    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Verify password using constant-time comparison
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Check account status
    if (!user.isActive) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Account has been deactivated. Please contact support.'
      });
    }

    // Enforce buyer role scope on buyer login endpoint
    if (user.role !== UserRole.BUYER) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Sign role-bound buyer session token
    const token = signSessionToken(
      {
        userId: user.id,
        role: UserRole.BUYER,
        email: user.email,
        tokenVersion: user.tokenVersion ?? 0
      },
      getSecretForRole(UserRole.BUYER)
    );

    // Establish session strictly via HTTP-only cookie
    reply.header('Set-Cookie', serializeSessionCookie(token));

    return reply.status(200).send({
      statusCode: 200,
      message: 'Login successful',
      user: user.toUserSummary()
    });
  });

  /**
   * GET /api/v1/auth/me
   * Returns authenticated buyer profile from validated session cookie and live database state.
   */
  fastify.get('/me', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || request.user.role !== UserRole.BUYER) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Access denied: valid buyer session required'
      });
    }

    // Query current user from database to prevent stale token claims from granting access
    const user = request.dbUser || await findUserById(request.user.userId);
    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'User account not found'
      });
    }

    // Reject deactivated accounts
    if (!user.isActive) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Account has been deactivated'
      });
    }

    if (user.role !== UserRole.BUYER) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Access denied: valid buyer session required'
      });
    }

    return reply.status(200).send({
      statusCode: 200,
      user: user.toUserSummary()
    });
  });

  /**
   * POST /api/v1/auth/super-admin/login
   * Authenticates super admin credentials and sets role-bound session cookie.
   */
  fastify.post('/super-admin/login', { preHandler: [rateLimitLogin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = SuperAdminLoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors.map((e) => e.message).join('; ')
      });
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await findUserByEmail(normalizedEmail, true);
    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Account has been deactivated. Please contact platform administration.'
      });
    }

    // Strictly enforce SUPER_ADMIN role (SEC-02 Core Defense)
    if (user.role !== UserRole.SUPER_ADMIN) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Sign strictly with isolated super admin secret
    const token = signSessionToken(
      {
        userId: user.id,
        role: UserRole.SUPER_ADMIN,
        email: user.email,
        tokenVersion: user.tokenVersion ?? 0
      },
      getSecretForRole(UserRole.SUPER_ADMIN)
    );

    reply.header('Set-Cookie', serializeSessionCookie(token));

    return reply.status(200).send({
      statusCode: 200,
      message: 'Super admin login successful',
      token,
      user: user.toUserSummary()
    });
  });

  /**
   * GET /api/v1/auth/super-admin/me
   * Restores super admin session from HTTP-only cookie.
   */
  fastify.get('/super-admin/me', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || request.user.role !== UserRole.SUPER_ADMIN) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Access denied: valid super admin session required'
      });
    }

    const user = request.dbUser || await findUserById(request.user.userId);
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Super admin account not found'
      });
    }

    if (!user.isActive) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Super admin account has been deactivated'
      });
    }

    return reply.status(200).send({
      statusCode: 200,
      user: user.toUserSummary()
    });
  });

  /**
   * POST /api/v1/auth/vendor/register
   * Registers a wholesale vendor account, creates a stall record with isApproved: false,
   * and sets an HTTP-only session cookie bound to UserRole.SHOP_ADMIN.
   */
  fastify.post('/vendor/register', { preHandler: [rateLimitRegister] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = RegisterVendorSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors.map((e) => e.message).join('; ')
      });
    }

    const { email, password, fullName, stallName, stallNumber, tradeLicenseNumber, phone } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check existing email
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'An account with this email already exists'
      });
    }

    const passwordHash = await hashPassword(password);

    // 1. Create Stall Record (unapproved by default)
    let shop;
    try {
      shop = await createShop({
        name: stallName,
        stallNumber,
        tradeLicenseNumber,
        phone,
        ownerId: 'pending',
        isApproved: false,
        isActive: true
      });
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 11000) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'A stall with this name or slug already exists'
        });
      }
      throw err;
    }

    // 2. Create Vendor User
    let newUser;
    try {
      newUser = await createShopAdminUser({
        email: normalizedEmail,
        passwordHash,
        fullName,
        shopId: shop.id,
        businessName: stallName,
        phone,
        tradeLicenseNumber
      });
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 11000) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'An account with this email already exists'
        });
      }
      throw err;
    }

    // 3. Link ownerId to shop
    shop.ownerId = newUser.id;

    // 4. Sign token with SHOP_ADMIN isolated secret (SEC-02)
    const token = signSessionToken(
      {
        userId: newUser.id,
        role: UserRole.SHOP_ADMIN,
        email: newUser.email,
        shopId: shop.id,
        tokenVersion: newUser.tokenVersion ?? 0
      },
      getSecretForRole(UserRole.SHOP_ADMIN)
    );

    reply.header('Set-Cookie', serializeSessionCookie(token));

    return reply.status(201).send({
      statusCode: 201,
      message: 'Vendor registration successful. Stall pending Super Admin approval.',
      user: newUser.toUserSummary(),
      shop: shop.toPublicSummary()
    });
  });

  /**
   * POST /api/v1/auth/vendor/login
   * Authenticates vendor (Shop Admin) credentials, sets role-bound session cookie.
   */
  fastify.post('/vendor/login', { preHandler: [rateLimitLogin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = ShopAdminLoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors.map((e) => e.message).join('; ')
      });
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await findUserByEmail(normalizedEmail, true);
    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Vendor account has been deactivated. Please contact platform administration.'
      });
    }

    // Role enforcement: must be SHOP_ADMIN or legacy VENDOR
    if (user.role !== UserRole.SHOP_ADMIN && user.role !== UserRole.VENDOR) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Retrieve vendor's shop
    let shop = null;
    if (user.shopId) {
      shop = await findShopById(user.shopId);
    }
    if (!shop) {
      shop = await findShopByOwnerId(user.id);
    }

    // Sign with SHOP_ADMIN isolated secret
    const token = signSessionToken(
      {
        userId: user.id,
        role: UserRole.SHOP_ADMIN,
        email: user.email,
        shopId: shop?.id || user.shopId,
        tokenVersion: user.tokenVersion ?? 0
      },
      getSecretForRole(UserRole.SHOP_ADMIN)
    );

    reply.header('Set-Cookie', serializeSessionCookie(token));

    return reply.status(200).send({
      statusCode: 200,
      message: 'Vendor login successful',
      token,
      user: user.toUserSummary(),
      shop: shop ? shop.toPublicSummary() : null
    });
  });

  /**
   * GET /api/v1/auth/vendor/me
   * Restores vendor session and returns current stall profile.
   */
  fastify.get('/vendor/me', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || (request.user.role !== UserRole.SHOP_ADMIN && request.user.role !== UserRole.VENDOR)) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Access denied: valid vendor session required'
      });
    }

    const user = request.dbUser || await findUserById(request.user.userId);
    if (!user || (user.role !== UserRole.SHOP_ADMIN && user.role !== UserRole.VENDOR)) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Vendor account not found'
      });
    }

    if (!user.isActive) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Vendor account has been deactivated'
      });
    }

    let shop = null;
    const shopId = request.user.shopId || user.shopId;
    if (shopId) {
      shop = await findShopById(shopId);
    }
    if (!shop) {
      shop = await findShopByOwnerId(user.id);
    }

    return reply.status(200).send({
      statusCode: 200,
      user: user.toUserSummary(),
      shop: shop ? shop.toPublicSummary() : null
    });
  });

  /**
   * POST /api/v1/auth/logout
   * Server-side JWT revocation via atomic tokenVersion increment and cookie clearance.
   * Attaches cookie-clearing header even if upstream database revocation fails.
   */
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    // Always attach the cookie-clearing header to guarantee client session hygiene
    reply.header('Set-Cookie', serializeSessionCookie('', { clear: true }));

    let token: string | undefined;

    // 1. Try reading token from HTTP-only session cookie
    if (request.headers.cookie) {
      const cookieToken = parseCookie(request.headers.cookie, SESSION_COOKIE_NAME);
      if (cookieToken) {
        token = cookieToken.trim();
      }
    }

    // 2. Fall back to Authorization: Bearer <token> header
    if (!token && request.headers.authorization?.startsWith('Bearer ')) {
      token = request.headers.authorization.substring(7).trim();
    }

    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 2 && parts[0]) {
          const jsonString = Buffer.from(parts[0], 'base64url').toString('utf8');
          const unverified = JSON.parse(jsonString) as Record<string, unknown>;
          if (unverified && typeof unverified === 'object' && typeof unverified.role === 'string') {
            const secret = getSecretForRole(unverified.role);
            const verified = verifySessionToken(token, secret);
            if (verified && verified.userId) {
              await incrementUserTokenVersion(verified.userId);
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DatabaseUnavailableError || (err as { statusCode?: number })?.statusCode === 503) {
          return reply.status(503).send({
            statusCode: 503,
            error: 'Service Unavailable',
            message: 'Database is disconnected. Operation rejected in fail-closed mode.'
          });
        }
        request.log.error({ err }, 'Error during logout token revocation');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to revoke session token'
        });
      }
    }

    return reply.status(200).send({
      statusCode: 200,
      message: 'Logged out successfully'
    });
  });
};
