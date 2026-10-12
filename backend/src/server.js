import { createApp } from './app.js';
import { env, assertProductionConfig } from './config/env.js';
import { connectDB } from './config/db.js';
import { cloudinaryConnect } from './config/cloudinary.js';
import { logger } from './utils/logger.js';

async function main() {
  assertProductionConfig();
  await connectDB();
  cloudinaryConnect();

  const server = createApp().listen(env.port, () => {
    logger.info(`up backend listening on ${env.publicBaseUrl} (env: ${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received; shutting down.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error('Fatal startup error:', error);
  process.exit(1);
});
