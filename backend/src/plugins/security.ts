import crypto from 'node:crypto';
import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { AuthSessionPayload, UserRole, isShopAdminRole, isSuperAdminRole } from '@aweermarket/types';
import { verifySessionToken } from '../utils/crypto.js';
import { parseCookie, SESSION_COOKIE_NAME } from '../utils/cookie.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthSessionPayload;
  }
}

export const MIN_SECRET_LENGTH = 32;

export interface SecurityConfig {
  jwtSecret?: string;
  adminJwtSecret?: string;
  superAdminJwtSecret?: string;
}

/**
 * Validates secret strength and presence without printing secret values in errors or logs.
 * Throws explicit error if secret is missing or too short.
 */
export function validateSecret(secretName: string, secretValue: string | undefined): string {
  if (!secretValue || typeof secretValue !== 'string' || secretValue.trim().length === 0) {
    throw new Error(`Security Configuration Error: Missing required signing secret '${secretName}'. Server cannot start securely.`);
  }
  if (secretValue.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Security Configuration Error: '${secretName}' must be at least ${MIN_SECRET_LENGTH} characters long (current length: ${secretValue.length}).`
    );
  }
  return secretValue;
}

/**
 * Validates that all required secrets for role domains are properly configured.
 * Runs on startup to fail closed early.
 */
export function validateAllSecrets(config?: SecurityConfig): void {
  // If NODE_ENV is test and no explicit secrets provided, allow test harness override
  if (process.env.NODE_ENV === 'test' && !config && !process.env.JWT_SECRET) {
    return;
  }

  const baseSecret = config?.jwtSecret ?? process.env.JWT_SECRET;
  validateSecret('JWT_SECRET', baseSecret);

  const adminSecret = config !== undefined ? config.adminJwtSecret : process.env.ADMIN_JWT_SECRET;
  if (adminSecret) {
    validateSecret('ADMIN_JWT_SECRET', adminSecret);
  }

  const superAdminSecret = config !== undefined ? config.superAdminJwtSecret : process.env.SUPER_ADMIN_JWT_SECRET;
  if (superAdminSecret) {
    validateSecret('SUPER_ADMIN_JWT_SECRET', superAdminSecret);
    if (superAdminSecret === baseSecret) {
      throw new Error("Security Configuration Error: 'SUPER_ADMIN_JWT_SECRET' cannot be identical to 'JWT_SECRET'.");
    }
  }
}

/**
 * Returns the cryptographic signing/verification secret bound strictly to a specific role.
 * Fails closed if the secret is missing or weak.
 * NEVER uses hardcoded fallback strings.
 * In a shared-key arrangement (where only JWT_SECRET is configured), securely derives
 * cryptographically distinct role-bound keys via HMAC domain separation.
 */
export function getSecretForRole(role?: UserRole | string, configOverride?: SecurityConfig): string {
  const baseSecret = validateSecret('JWT_SECRET', configOverride?.jwtSecret ?? process.env.JWT_SECRET);

  if (role === UserRole.SUPER_ADMIN) {
    const superSecret = configOverride !== undefined ? configOverride.superAdminJwtSecret : process.env.SUPER_ADMIN_JWT_SECRET;
    if (superSecret) {
      return validateSecret('SUPER_ADMIN_JWT_SECRET', superSecret);
    }
    // Secure shared-key arrangement: derive cryptographically distinct role-bound key
    return crypto.createHmac('sha256', baseSecret).update('aweermarket:role:super_admin').digest('hex');
  }

  if (role === UserRole.SHOP_ADMIN || role === UserRole.ADMIN || role === UserRole.VENDOR) {
    const adminSecret = configOverride !== undefined ? configOverride.adminJwtSecret : process.env.ADMIN_JWT_SECRET;
    if (adminSecret) {
      return validateSecret('ADMIN_JWT_SECRET', adminSecret);
    }
    // Secure shared-key arrangement: derive cryptographically distinct role-bound key
    return crypto.createHmac('sha256', baseSecret).update('aweermarket:role:shop_admin').digest('hex');
  }

  return baseSecret;
}

/**
 * PreHandler hook: Role-bound signature verification.
 * Enforces SEC-02: Selects verification key based on the claimed role.
 * A signature valid under the buyer key CANNOT authenticate a token claiming super_admin or shop_admin.
 * Supports extracting token from HTTP-only session cookie (aweer_session) or Bearer header.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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

  if (!token) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication token is required'
    });
  }

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Malformed token structure'
    });
  }

  // 1. Inspect unverified payload structure to identify the claimed role
  let unverifiedPayload: unknown;
  try {
    const jsonString = Buffer.from(parts[0], 'base64url').toString('utf8');
    unverifiedPayload = JSON.parse(jsonString);
  } catch {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Malformed token payload encoding'
    });
  }

  if (!unverifiedPayload || typeof unverifiedPayload !== 'object' || Array.isArray(unverifiedPayload)) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Malformed token payload structure'
    });
  }

  const payloadObj = unverifiedPayload as Record<string, unknown>;
  const claimedRole = payloadObj.role;
  const validRoles = Object.values(UserRole) as string[];

  if (!claimedRole || typeof claimedRole !== 'string' || !validRoles.includes(claimedRole)) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Missing or unrecognized role claim in token'
    });
  }

  // 2. Select the EXACT cryptographic secret bound to the claimed role
  let requiredSecret: string;
  try {
    requiredSecret = getSecretForRole(claimedRole);
  } catch {
    request.log.error({ msg: 'Secret configuration failure during authentication' });
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Server security configuration is invalid'
    });
  }

  // 3. Cryptographically verify signature using ONLY the role-bound secret
  const verifiedPayload = verifySessionToken(token, requiredSecret);
  if (!verifiedPayload) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid token signature for claimed role'
    });
  }

  // 4. Validate payload integrity and essential claims
  if (verifiedPayload.role !== claimedRole) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Role claim tampering detected'
    });
  }

  if (!verifiedPayload.userId || typeof verifiedPayload.userId !== 'string') {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid token subject claim'
    });
  }

  // Attach trusted, cryptographically validated user identity
  request.user = verifiedPayload;
}

/**
 * PreHandler hook factory: Enforces role-based access control.
 * Rejects insufficient permissions with 403 Forbidden.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const userRole = request.user.role;

    // Strict evaluation against allowedRoles
    const isAuthorized = allowedRoles.some((allowed) => {
      if (allowed === UserRole.SUPER_ADMIN) {
        return isSuperAdminRole(userRole) && userRole === UserRole.SUPER_ADMIN;
      }
      if (allowed === UserRole.SHOP_ADMIN) {
        return isShopAdminRole(userRole) || userRole === UserRole.SUPER_ADMIN;
      }
      return userRole === allowed || userRole === UserRole.SUPER_ADMIN;
    });

    if (!isAuthorized) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: insufficient permissions'
      });
    }
  };
}

/**
 * PreHandler hook factory: Enforces multi-tenant shop data isolation.
 * Prevents Shop Admin from accessing data belonging to other shops.
 */
export function requireTenantScope(resourceShopIdKey = 'shopId') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    // Super Admin has platform-wide governance access
    if (request.user.role === UserRole.SUPER_ADMIN) {
      return;
    }

    // Extract target shopId from route params or query
    const params = request.params as Record<string, string> | undefined;
    const query = request.query as Record<string, string> | undefined;
    const requestedShopId = params?.[resourceShopIdKey] || query?.[resourceShopIdKey];

    if (!requestedShopId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Resource tenant identifier '${resourceShopIdKey}' is required`
      });
    }

    const assignedShopId = request.user.shopId || request.user.vendorId;

    if (!assignedShopId || assignedShopId !== requestedShopId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Cross-tenant access denied: you are not authorized for this shop'
      });
    }
  };
}

/**
 * Fastify plugin registering security headers, error filtering, and startup secret validation.
 */
export const securityPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Validate secrets on startup (fails closed if secrets are missing or weak)
  validateAllSecrets();

  // Safe error handler: Never leaks passwords, secrets, or internal stack traces to client
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({
      err: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode
      },
      url: request.raw.url,
      method: request.raw.method
    });

    const statusCode = error.statusCode || 500;
    const message = statusCode >= 500 ? 'Internal server error' : error.message;

    return reply.status(statusCode).send({
      statusCode,
      error: error.name || 'Error',
      message
    });
  });
};
