import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import { healthRoutes } from './routes/health.js';
import { connectDatabase, disconnectDatabase } from './plugins/db.js';

dotenv.config();

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info'
    }
  });

  // Security Headers
  await server.register(helmet, {
    contentSecurityPolicy: false // Disabled for local dev/API
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

async function start() {
  try {
    // Connect to database
    await connectDatabase();

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
  } catch (err) {
    console.error('[AweerMarket API] Failed to start server:', err);
    process.exit(1);
  }
}

// Start if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  start();
}
