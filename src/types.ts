export type PCStatus = 'online' | 'offline' | 'synced';

export interface AgentInfo {
  agentId: string;
  hostname?: string;
  ip?: string;
  status: PCStatus;
  lastHeartbeat: number;
  connectedAt: number;
  metadata?: Record<string, unknown>;
}

export type WSClientMessage =
  | {
      type: 'AUTH';
      token: string;
      agentId: string;
      hostname?: string;
      ip?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'HEARTBEAT';
      agentId: string;
      timestamp?: number;
      metrics?: Record<string, unknown>;
    }
  | {
      type: 'STATUS_UPDATE';
      agentId: string;
      status: PCStatus;
    };

export type WSServerMessage =
  | {
      type: 'ACK';
      status: 'authenticated';
      agentId: string;
      serverTime: number;
    }
  | {
      type: 'HEARTBEAT_ACK';
      agentId: string;
      timestamp: number;
    }
  | {
      type: 'ERROR';
      message: string;
    }
  | {
      type: 'STATE_SNAPSHOT';
      agents: Record<string, AgentInfo>;
    };
