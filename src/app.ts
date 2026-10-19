import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { healthRoutes } from './routes/health.js';
import { wsRoutes } from './routes/ws.js';
import { mirrorRoutes } from './routes/mirror.js';
import { PCStateManager } from './services/pcState.js';
import { MirrorService } from './services/mirror.js';
import { config } from './config.js';

export interface AppOptions extends FastifyServerOptions {
  stateManager?: PCStateManager;
  mirrorService?: MirrorService;
  labToken?: string;
  heartbeatTimeoutMs?: number;
  mirrorStorageDir?: string;
}

export function buildApp(opts: AppOptions = {}): {
  app: FastifyInstance;
  stateManager: PCStateManager;
  mirrorService: MirrorService;
} {
  const {
    stateManager = new PCStateManager(opts.heartbeatTimeoutMs || config.heartbeatTimeoutMs),
    mirrorService = new MirrorService(opts.mirrorStorageDir || config.mirrorStorageDir),
    labToken = config.labToken,
    ...fastifyOpts
  } = opts;

  const app = fastify(fastifyOpts);

  // Register WebSocket plugin
  app.register(fastifyWebsocket);

  // Register HTTP routes
  app.register(healthRoutes);

  // Register Mirror routes
  app.register(async (instance) => {
    await mirrorRoutes(instance, {
      mirrorService,
    });
  });

  // Register WS routes
  app.register(async (instance) => {
    await wsRoutes(instance, {
      stateManager,
      labToken,
    });
  });

  return { app, stateManager, mirrorService };
}
