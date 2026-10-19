import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Health Check Route', () => {
  const { app } = buildApp();

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns HTTP 200 and status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('timestamp');
  });
});
