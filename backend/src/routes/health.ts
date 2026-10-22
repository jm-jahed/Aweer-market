import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { HealthCheckResponse, LivenessResponse, ReadinessResponse } from '@aweermarket/types';
import { isDatabaseConnected, getDatabaseState } from '../plugins/db.js';

export const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Backward-compatible general health endpoint
  fastify.get('/health', async (_req, reply) => {
    const isDbConnected = isDatabaseConnected();
    const response: HealthCheckResponse = {
      status: isDbConnected ? 'ok' : 'degraded',
      service: 'AweerMarket Central API',
      timestamp: new Date().toISOString(),
      version: '1.0.0-phase1',
      database: isDbConnected ? 'connected' : 'disconnected'
    };
    return reply.status(200).send(response);
  });

  // Dedicated API Liveness Endpoint (always 200 when API process is alive)
  fastify.get('/health/live', async (_req, reply) => {
    const response: LivenessResponse = {
      status: 'ok',
      check: 'liveness',
      service: 'AweerMarket Central API',
      timestamp: new Date().toISOString()
    };
    return reply.status(200).send(response);
  });

  // Dedicated Database Readiness Endpoint (strictly returns 503 if database is disconnected)
  fastify.get('/health/ready', async (_req, reply) => {
    const isDbConnected = isDatabaseConnected();
    const dbState = getDatabaseState();

    if (!isDbConnected) {
      const unavailableResponse: ReadinessResponse = {
        status: 'unavailable',
        check: 'readiness',
        database: 'disconnected',
        error: `Database is not ready (current state: ${dbState})`,
        timestamp: new Date().toISOString()
      };
      return reply.status(503).send(unavailableResponse);
    }

    const readyResponse: ReadinessResponse = {
      status: 'ready',
      check: 'readiness',
      database: 'connected',
      timestamp: new Date().toISOString()
    };
    return reply.status(200).send(readyResponse);
  });
};
