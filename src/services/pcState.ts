import { EventEmitter } from 'events';
import { AgentInfo, PCStatus } from '../types.js';

export interface StateManagerEvents {
  'status_change': (agent: AgentInfo, previousStatus: PCStatus) => void;
  'agent_registered': (agent: AgentInfo) => void;
  'agent_offline': (agent: AgentInfo) => void;
}

export class PCStateManager extends EventEmitter {
  private agents: Map<string, AgentInfo> = new Map();
  private heartbeatTimeoutMs: number;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(heartbeatTimeoutMs: number = 5000) {
    super();
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
  }

  public startSweeper(intervalMs: number = 1000): void {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => {
      this.sweepTimeouts();
    }, intervalMs);
  }

  public stopSweeper(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public sweepTimeouts(): void {
    const now = Date.now();
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.status !== 'offline') {
        if (now - agent.lastHeartbeat > this.heartbeatTimeoutMs) {
          const prev = agent.status;
          agent.status = 'offline';
          this.emit('status_change', agent, prev);
          this.emit('agent_offline', agent);
        }
      }
    }
  }

  public registerAgent(info: Omit<AgentInfo, 'status' | 'lastHeartbeat' | 'connectedAt'>): AgentInfo {
    const now = Date.now();
    const existing = this.agents.get(info.agentId);
    const agent: AgentInfo = {
      ...info,
      status: 'online',
      connectedAt: existing?.connectedAt || now,
      lastHeartbeat: now,
    };
    this.agents.set(info.agentId, agent);
    this.emit('agent_registered', agent);
    if (existing && existing.status !== 'online') {
      this.emit('status_change', agent, existing.status);
    }
    return agent;
  }

  public recordHeartbeat(agentId: string, timestamp?: number): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }
    const prev = agent.status;
    agent.lastHeartbeat = timestamp || Date.now();
    if (agent.status === 'offline') {
      agent.status = 'online';
      this.emit('status_change', agent, prev);
    }
    return true;
  }

  public updateStatus(agentId: string, status: PCStatus): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    const prev = agent.status;
    agent.status = status;
    agent.lastHeartbeat = Date.now();
    if (prev !== status) {
      this.emit('status_change', agent, prev);
    }
    return true;
  }

  public markDisconnected(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    if (agent.status !== 'offline') {
      const prev = agent.status;
      agent.status = 'offline';
      this.emit('status_change', agent, prev);
      this.emit('agent_offline', agent);
    }
  }

  public getAgent(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }

  public getAllAgents(): Record<string, AgentInfo> {
    const result: Record<string, AgentInfo> = {};
    for (const [id, agent] of this.agents.entries()) {
      result[id] = { ...agent };
    }
    return result;
  }

  public getConnectedCount(): number {
    let count = 0;
    for (const agent of this.agents.values()) {
      if (agent.status === 'online' || agent.status === 'synced') {
        count++;
      }
    }
    return count;
  }

  public clear(): void {
    this.agents.clear();
  }
}
