import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { HealthCheckResponse } from '@aweermarket/types';
import mongoose from 'mongoose';

export const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/health', async (_req, reply) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    const response: HealthCheckResponse = {
      status: 'ok',
      service: 'AweerMarket Central API',
      timestamp: new Date().toISOString(),
      version: '1.0.0-phase1',
      database: isDbConnected ? 'connected' : 'disconnected'
    };
    return reply.status(200).send(response);
  });
};
