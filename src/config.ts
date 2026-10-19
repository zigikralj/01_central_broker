import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  port: number;
  host: string;
  labToken: string;
  heartbeatTimeoutMs: number;
  mirrorStorageDir: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  labToken: process.env.LAB_TOKEN || 'lab-secret-token-123',
  heartbeatTimeoutMs: parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '5000', 10),
  mirrorStorageDir: process.env.MIRROR_STORAGE_DIR || './storage/mirror',
};
