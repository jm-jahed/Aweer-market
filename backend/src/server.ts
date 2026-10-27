import net from 'node:net';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import dotenv from 'dotenv';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { productsRoutes } from './routes/products.js';
import { adminRoutes } from './routes/admin.js';
import { vendorRoutes } from './routes/vendor.js';
import { ordersRoutes } from './routes/orders.js';
import { connectDatabase, disconnectDatabase } from './plugins/db.js';
import { securityPlugin, safeErrorHandler } from './plugins/security.js';
import { ensureDefaultCategories } from './models/category.model.js';

dotenv.config();

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

const VALID_PROXY_ALIASES = new Set(['loopback', 'linklocal', 'uniquelocal']);

/**
 * Validates and normalizes trustProxy configuration for Fastify.
 * Rejects arbitrary strings, malformed IPs, and invalid CIDR masks with fail-closed security.
 */
export function parseTrustProxyConfig(val?: string | boolean | string[]): boolean | string | string[] {
  if (val === undefined || val === null || val === false) {
    return false;
  }
  if (val === true) {
    return true;
  }

  const rawEntries: string[] = Array.isArray(val)
    ? val
    : String(val).split(',').map((s) => s.trim()).filter(Boolean);

  if (rawEntries.length === 0) {
    return false;
  }

  // Handle single boolean-like strings
  if (rawEntries.length === 1) {
    const single = rawEntries[0].toLowerCase();
    if (single === 'false' || single === '0') return false;
    if (single === 'true' || single === '1') return true;
  }

  const validatedEntries: string[] = [];

  for (const entry of rawEntries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    if (VALID_PROXY_ALIASES.has(lower)) {
      validatedEntries.push(lower);
      continue;
    }

    // Check if it's a CIDR notation: <ip>/<mask>
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length !== 2) {
        throw new Error(
          `Security Configuration Error: Invalid TRUST_PROXY entry '${trimmed}'. Malformed CIDR notation.`
        );
      }
      const [ipPart, maskPart] = parts;
      const ipVersion = net.isIP(ipPart);
      if (ipVersion === 0) {
        throw new Error(
          `Security Configuration Error: Invalid TRUST_PROXY entry '${trimmed}'. '${ipPart}' is not a valid IP address.`
        );
      }
      if (!/^\d+$/.test(maskPart)) {
        throw new Error(
          `Security Configuration Error: Invalid TRUST_PROXY entry '${trimmed}'. Mask '${maskPart}' must be an integer.`
        );
      }
      const mask = Number(maskPart);
      if (ipVersion === 4 && (mask < 0 || mask > 32)) {
        throw new Error(
          `Security Configuration Error: Invalid TRUST_PROXY entry '${trimmed}'. IPv4 CIDR mask must be between 0 and 32.`
        );
      }
      if (ipVersion === 6 && (mask < 0 || mask > 128)) {
        throw new Error(
          `Security Configuration Error: Invalid TRUST_PROXY entry '${trimmed}'. IPv6 CIDR mask must be between 0 and 128.`
        );
      }
      validatedEntries.push(trimmed);
      continue;
    }

    // Check single IP (IPv4 or IPv6)
    const ipVersion = net.isIP(trimmed);
    if (ipVersion !== 0) {
      validatedEntries.push(trimmed);
      continue;
    }

    throw new Error(
      `Security Configuration Error: Invalid TRUST_PROXY entry '${trimmed}'. Must be a valid IP address, CIDR subnet, or supported alias ('loopback', 'linklocal', 'uniquelocal').`
    );
  }

  if (validatedEntries.length === 0) {
    return false;
  }
  return validatedEntries.length === 1 ? validatedEntries[0] : validatedEntries;
}

export interface BuildServerOptions {
  trustProxy?: boolean | string | string[];
}

export async function buildServer(options?: BuildServerOptions) {
  const resolvedTrustProxy = options && options.trustProxy !== undefined
    ? (typeof options.trustProxy === 'boolean' ? options.trustProxy : parseTrustProxyConfig(options.trustProxy))
    : parseTrustProxyConfig(process.env.TRUST_PROXY);

  const server = Fastify({
    trustProxy: resolvedTrustProxy,
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info'
    }
  });

  // Multipart support for image uploads (enforce 5 MiB ceiling)
  await server.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1
    }
  });

  // Global Safe Error Handler (sanitizes 503 and 500 across all routes)
  server.setErrorHandler(safeErrorHandler);

  // Security Plugin (error sanitization and startup secret verification)
  await server.register(securityPlugin);

  // Security Headers
  await server.register(helmet, {
    contentSecurityPolicy: false, // Disabled for local dev/API
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  });

  // CORS Configuration
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3100',
    'http://localhost:3101',
    'http://localhost:3102'
  ];
  const allowedOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : defaultOrigins;

  await server.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  // Base API routes
  await server.register(healthRoutes, { prefix: '/api/v1' });
  await server.register(healthRoutes); // root /health alias

  // Authentication routes
  await server.register(authRoutes, { prefix: '/api/v1/auth' });

  // Public Catalog & Product routes
  await server.register(productsRoutes, { prefix: '/api/v1' });

  // Super Admin Governance routes
  await server.register(adminRoutes, { prefix: '/api/v1/admin' });

  // Vendor / Shop Admin routes
  await server.register(vendorRoutes, { prefix: '/api/v1/vendor' });

  // Buyer Orders routes
  await server.register(ordersRoutes, { prefix: '/api/v1' });

  server.get('/', async (_req, reply) => {
    return reply.send({
      brand: 'AweerMarket',
      market: 'Dubai Al Aweer Wholesale Fruits & Vegetables Marketplace',
      status: 'operational',
      documentation: '/api/v1/health'
    });
  });

  return server;
}

export async function start() {
  try {
    // Fail-closed database connection check before accepting any requests
    const connected = await connectDatabase();
    if (!connected && process.env.NODE_ENV !== 'test' && process.env.ALLOW_IN_MEMORY_DB !== 'true') {
      throw new Error('[AweerMarket API] Database connection failed. Startup aborted in fail-closed mode.');
    }

    if (connected) {
      await ensureDefaultCategories();
      const { ensureDefaultSuperAdmin } = await import('./seed.js');
      await ensureDefaultSuperAdmin();
      const { removeDemoProducts } = await import('./models/product.model.js');
      await removeDemoProducts();
    }

    if (process.env.ALLOW_IN_MEMORY_DB === 'true') {
      const { seedDemoData } = await import('./seed.js');
      await seedDemoData();
    }

    const server = await buildServer();
    await server.listen({ port, host });
    console.log(`[AweerMarket API] Central API running at http://${host}:${port}`);

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        console.log(`[AweerMarket API] Received ${signal}. Shutting down gracefully...`);
        await server.close();
        await disconnectDatabase();
        process.exit(0);
      });
    }

    return server;
  } catch (err) {
    console.error('[AweerMarket API] Failed to start server:', err);
    throw err;
  }
}

// Start if executed directly
const isDirectRun = Boolean(
  process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))
);

if (isDirectRun) {
  start().catch(() => {
    process.exit(1);
  });
}
