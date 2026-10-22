import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { RegisterBuyerSchema, LoginSchema } from '@aweermarket/validation';
import { UserRole } from '@aweermarket/types';
import { hashPassword, verifyPassword, signSessionToken } from '../utils/crypto.js';
import { getSecretForRole, authenticate } from '../plugins/security.js';
import { serializeSessionCookie } from '../utils/cookie.js';
import {
  findUserByEmail,
  findUserById,
  createBuyerUser
} from '../models/user.model.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/v1/auth/register
   * Registers a provisional buyer account and sets HTTP-only session cookie.
   */
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
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
        email: newUser.email
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
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
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
        email: user.email
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
    const user = await findUserById(request.user.userId);
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
   * POST /api/v1/auth/logout
   * Clears the HTTP-only session cookie.
   */
  fastify.post('/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Set-Cookie', serializeSessionCookie('', { clear: true }));

    return reply.status(200).send({
      statusCode: 200,
      message: 'Logged out successfully'
    });
  });
};
