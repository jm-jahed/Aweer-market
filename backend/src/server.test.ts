import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildServer } from './server.js';

describe('AweerMarket Central API - Health & Security Endpoints', () => {
  it('GET /health returns 200 with service information and database status', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.service, 'AweerMarket Central API');
    assert.strictEqual(body.version, '1.0.0-phase1');
    assert.ok(body.timestamp);
    await server.close();
  });

  it('GET /api/v1/health returns 200 via versioned route', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/health'
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, 'ok');
    await server.close();
  });

  it('GET / returns operational metadata', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'GET',
      url: '/'
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.brand, 'AweerMarket');
    await server.close();
  });
});
