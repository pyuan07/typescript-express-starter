import { PrismaClient } from '@prisma/client';

// Global Prisma client instance
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Graceful shutdown handling
const cleanup = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error during Prisma cleanup:', error);
  }
};

// Register cleanup handlers
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('beforeExit', cleanup);

export default prisma;
