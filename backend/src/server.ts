import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { productsRoutes } from './routes/products.js';
import { adminRoutes } from './routes/admin.js';
import { vendorRoutes } from './routes/vendor.js';
import { ordersRoutes } from './routes/orders.js';
import { connectDatabase, disconnectDatabase } from './plugins/db.js';
import { securityPlugin, safeErrorHandler } from './plugins/security.js';

dotenv.config();

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info'
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
