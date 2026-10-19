import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { PCStateManager } from '../services/pcState.js';
import { WSClientMessage, WSServerMessage } from '../types.js';

export interface WSRouteOptions {
  stateManager: PCStateManager;
  labToken: string;
  authTimeoutMs?: number;
}

export async function wsRoutes(
  fastify: FastifyInstance,
  options: WSRouteOptions
) {
  const { stateManager, labToken, authTimeoutMs = 5000 } = options;

  fastify.get('/ws', { websocket: true }, (socket: WebSocket, req) => {
    let isAuthenticated = false;
    let connectedAgentId: string | null = null;

    // Timeout if client does not authenticate in time
    const authTimer = setTimeout(() => {
      if (!isAuthenticated) {
        const errorMsg: WSServerMessage = {
          type: 'ERROR',
          message: 'Authentication timeout',
        };
        socket.send(JSON.stringify(errorMsg));
        socket.close(4401, 'Authentication timeout');
      }
    }, authTimeoutMs);

    socket.on('message', (rawData: Buffer | string) => {
      let message: WSClientMessage;
      try {
        message = JSON.parse(rawData.toString());
      } catch {
        const errorMsg: WSServerMessage = {
          type: 'ERROR',
          message: 'Invalid JSON payload',
        };
        socket.send(JSON.stringify(errorMsg));
        return;
      }

      if (!isAuthenticated) {
        if (message.type === 'AUTH') {
          if (message.token === labToken && message.agentId) {
            isAuthenticated = true;
            connectedAgentId = message.agentId;
            clearTimeout(authTimer);

            stateManager.registerAgent({
              agentId: message.agentId,
              hostname: message.hostname,
              ip: message.ip || req.ip,
              metadata: message.metadata,
            });

            const ack: WSServerMessage = {
              type: 'ACK',
              status: 'authenticated',
              agentId: message.agentId,
              serverTime: Date.now(),
            };
            socket.send(JSON.stringify(ack));
          } else {
            clearTimeout(authTimer);
            const errorMsg: WSServerMessage = {
              type: 'ERROR',
              message: 'Authentication failed: Invalid credentials',
            };
            socket.send(JSON.stringify(errorMsg));
            socket.close(4401, 'Invalid credentials');
          }
        } else {
          const errorMsg: WSServerMessage = {
            type: 'ERROR',
            message: 'Authentication required before sending commands',
          };
          socket.send(JSON.stringify(errorMsg));
          socket.close(4401, 'Unauthenticated');
        }
        return;
      }

      // Handlers for authenticated messages
      if (message.type === 'HEARTBEAT') {
        stateManager.recordHeartbeat(connectedAgentId!, message.timestamp);
        const hbAck: WSServerMessage = {
          type: 'HEARTBEAT_ACK',
          agentId: connectedAgentId!,
          timestamp: Date.now(),
        };
        socket.send(JSON.stringify(hbAck));
      } else if (message.type === 'STATUS_UPDATE') {
        stateManager.updateStatus(connectedAgentId!, message.status);
      }
    });

    socket.on('close', () => {
      clearTimeout(authTimer);
      if (isAuthenticated && connectedAgentId) {
        stateManager.markDisconnected(connectedAgentId);
      }
    });

    socket.on('error', () => {
      clearTimeout(authTimer);
      if (isAuthenticated && connectedAgentId) {
        stateManager.markDisconnected(connectedAgentId);
      }
    });
  });

  // REST API route to view connected agent state
  fastify.get('/api/agents', async () => {
    return {
      agents: stateManager.getAllAgents(),
      totalConnected: stateManager.getConnectedCount(),
    };
  });

  fastify.get<{ Params: { agentId: string } }>('/api/agents/:agentId', async (req, reply) => {
    const agent = stateManager.getAgent(req.params.agentId);
    if (!agent) {
      return reply.status(404).send({ error: 'Agent not found' });
    }
    return agent;
  });
}
