import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../src/app.js';
import { AgentInfo } from '../src/types.js';

describe('Live Network Monitoring State', () => {
  const TEST_LAB_TOKEN = 'test-token-state';
  // Use a shorter heartbeat timeout for quick test execution (e.g. 1000ms <= 5000ms requirement)
  const HEARTBEAT_TIMEOUT_MS = 1000;

  const { app, stateManager } = buildApp({
    labToken: TEST_LAB_TOKEN,
    heartbeatTimeoutMs: HEARTBEAT_TIMEOUT_MS,
  });

  let serverPort: number;

  beforeAll(async () => {
    stateManager.startSweeper(200); // Sweep every 200ms
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const match = address.match(/:(\d+)$/);
    if (!match) throw new Error(`Could not determine port from ${address}`);
    serverPort = parseInt(match[1], 10);
  });

  afterAll(async () => {
    stateManager.stopSweeper();
    await app.close();
  });

  it('tracks 10 connected agents, updates state tree, and marks 2 dropped agents as offline within 5 seconds', async () => {
    const sockets: WebSocket[] = [];
    const agentIds: string[] = [];

    // Track offline events fired by the state manager
    const offlineEvents: AgentInfo[] = [];
    stateManager.on('agent_offline', (agent) => {
      offlineEvents.push({ ...agent });
    });

    // 1. Connect 10 agents
    for (let i = 1; i <= 10; i++) {
      const agentId = `pc-lab-${i.toString().padStart(2, '0')}`;
      agentIds.push(agentId);

      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);
      sockets.push(ws);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Authenticate
      ws.send(
        JSON.stringify({
          type: 'AUTH',
          token: TEST_LAB_TOKEN,
          agentId,
          hostname: `${agentId}.lab.lan`,
          ip: `192.168.10.${100 + i}`,
        })
      );

      // Wait for ACK
      await new Promise<void>((resolve) => {
        const handler = (data: WebSocket.Data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'ACK') {
            ws.off('message', handler);
            resolve();
          }
        };
        ws.on('message', handler);
      });
    }

    // 2. Verify all 10 agents are registered and online
    const stateTree1 = stateManager.getAllAgents();
    expect(Object.keys(stateTree1).length).toBe(10);
    expect(stateManager.getConnectedCount()).toBe(10);

    for (const id of agentIds) {
      expect(stateTree1[id]?.status).toBe('online');
    }

    // Check REST API snapshot
    const apiRes = await app.inject({
      method: 'GET',
      url: '/api/agents',
    });
    expect(apiRes.statusCode).toBe(200);
    const apiData = JSON.parse(apiRes.body);
    expect(apiData.totalConnected).toBe(10);

    // 3. Drop 2 agents (agent 0 and agent 1) by abruptly terminating their sockets
    const droppedAgents = [agentIds[0], agentIds[1]];
    const startTime = Date.now();

    sockets[0].terminate();
    sockets[1].terminate();

    // Keep the other 8 agents sending heartbeats
    const heartbeatInterval = setInterval(() => {
      for (let i = 2; i < 10; i++) {
        if (sockets[i].readyState === WebSocket.OPEN) {
          sockets[i].send(
            JSON.stringify({
              type: 'HEARTBEAT',
              agentId: agentIds[i],
              timestamp: Date.now(),
            })
          );
        }
      }
    }, 300);

    // Wait until offline events for the dropped agents are detected (within 5 seconds)
    await new Promise<void>((resolve, reject) => {
      const check = setInterval(() => {
        const dropped0 = stateManager.getAgent(droppedAgents[0]);
        const dropped1 = stateManager.getAgent(droppedAgents[1]);
        if (dropped0?.status === 'offline' && dropped1?.status === 'offline') {
          clearInterval(check);
          resolve();
        } else if (Date.now() - startTime > 5000) {
          clearInterval(check);
          reject(new Error('Timed out waiting for agents to be marked offline within 5s'));
        }
      }, 100);
    });

    clearInterval(heartbeatInterval);

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(5000); // Must be detected within 5 seconds

    // 4. Verify the updated state tree: 8 online, 2 offline
    const updatedState = stateManager.getAllAgents();
    expect(updatedState[droppedAgents[0]].status).toBe('offline');
    expect(updatedState[droppedAgents[1]].status).toBe('offline');

    for (let i = 2; i < 10; i++) {
      expect(updatedState[agentIds[i]].status).toBe('online');
    }

    expect(stateManager.getConnectedCount()).toBe(8);

    // Close remaining sockets
    for (let i = 2; i < 10; i++) {
      sockets[i].close();
    }
  });

  it('marks silent agents offline when heartbeats stop without socket close', async () => {
    // Test heartbeat timeout mechanism directly
    stateManager.registerAgent({
      agentId: 'silent-pc',
      hostname: 'silent.lab.lan',
    });

    expect(stateManager.getAgent('silent-pc')?.status).toBe('online');

    // Simulate time passing beyond timeout
    const agent = stateManager.getAgent('silent-pc')!;
    agent.lastHeartbeat = Date.now() - (HEARTBEAT_TIMEOUT_MS + 500);

    stateManager.sweepTimeouts();

    expect(stateManager.getAgent('silent-pc')?.status).toBe('offline');
  });
});
