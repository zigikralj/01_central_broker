import { buildApp } from './app.js';
import { config } from './config.js';

async function start() {
  const { app, stateManager } = buildApp({
    logger: true,
  });

  // Start background sweeper to detect heartbeat dropouts
  stateManager.startSweeper();

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Central Exam Broker listening on ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
