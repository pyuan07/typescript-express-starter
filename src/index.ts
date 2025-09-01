import { Server } from 'http';
import app from './app';
import config from './config/config';
import logger from './config/logger';
import prisma from './config/database';

let server: Server;

const main = async () => {
  try {
    // Test database connection
    await prisma.$connect();

    server = app.listen(config.port, () => {
      logger.info(`Listening to port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received - starting graceful shutdown`);

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      logger.info('Graceful shutdown completed');
      process.exit(0); // Success exit code
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

const unexpectedErrorHandler = async (error: Error): Promise<void> => {
  logger.error('Unexpected error:', error);

  if (server) {
    server.close(() => {
      process.exit(1); // Error exit code
    });

    // Force shutdown after 5 seconds for errors
    setTimeout(() => {
      logger.error('Forced shutdown after unexpected error');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(1);
  }
};

main();

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
