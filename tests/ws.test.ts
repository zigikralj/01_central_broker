import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../src/app.js';

describe('WebSocket Gateway Integration', () => {
  const TEST_LAB_TOKEN = 'test-secret-token';
  const { app, stateManager } = buildApp({
    labToken: TEST_LAB_TOKEN,
  });

  let serverPort: number;

  beforeAll(async () => {
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const match = address.match(/:(\d+)$/);
    if (!match) throw new Error(`Could not determine port from ${address}`);
    serverPort = parseInt(match[1], 10);
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts authenticated connection and returns ACK payload', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    // Send valid AUTH handshake
    ws.send(
      JSON.stringify({
        type: 'AUTH',
        token: TEST_LAB_TOKEN,
        agentId: 'lab-pc-01',
        hostname: 'pc01.lab.local',
      })
    );

    const receivedMessage = await new Promise<any>((resolve, reject) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
      ws.on('error', reject);
    });

    expect(receivedMessage.type).toBe('ACK');
    expect(receivedMessage.status).toBe('authenticated');
    expect(receivedMessage.agentId).toBe('lab-pc-01');
    expect(typeof receivedMessage.serverTime).toBe('number');

    // Verify agent is registered in stateManager
    const agent = stateManager.getAgent('lab-pc-01');
    expect(agent).toBeDefined();
    expect(agent?.status).toBe('online');

    ws.close();
  });

  it('rejects connection with invalid lab token and closes socket', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    ws.send(
      JSON.stringify({
        type: 'AUTH',
        token: 'wrong-token',
        agentId: 'lab-pc-02',
      })
    );

    const receivedMessage = await new Promise<any>((resolve) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(receivedMessage.type).toBe('ERROR');
    expect(receivedMessage.message).toContain('Authentication failed');

    const closeCode = await new Promise<number>((resolve) => {
      ws.on('close', (code) => {
        resolve(code);
      });
    });

    expect(closeCode).toBe(4401);
  });

  it('rejects commands when unauthenticated', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    ws.send(
      JSON.stringify({
        type: 'HEARTBEAT',
        agentId: 'lab-pc-03',
      })
    );

    const receivedMessage = await new Promise<any>((resolve) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(receivedMessage.type).toBe('ERROR');
    expect(receivedMessage.message).toContain('Authentication required');

    const closeCode = await new Promise<number>((resolve) => {
      ws.on('close', (code) => {
        resolve(code);
      });
    });

    expect(closeCode).toBe(4401);
  });
});
