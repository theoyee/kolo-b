import { buildApp } from './app';
import { config } from './config';
import prisma from './db/prisma';
import { notificationQueue } from './queue/bullmq';

async function start() {
  const app = buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      await app.close();
      await notificationQueue.close();
      await prisma.$disconnect();
      app.log.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    const address = await app.listen({ port: config.port, host: config.host });
    app.log.info(`🚀 Kolo SME Backend API running at ${address}`);
    app.log.info(`📖 OpenAPI documentation live at ${address}/documentation`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Start the Fastify server
start();

export { start };
