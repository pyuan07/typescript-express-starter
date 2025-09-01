import { PrismaClient } from '@prisma/client';

// Test-specific Prisma client configuration
let testPrisma: PrismaClient | null = null;

/**
 * Get or create a test database connection
 * Uses SQLite in-memory database for faster tests
 */
export const getTestPrismaClient = (): PrismaClient => {
  if (!testPrisma) {
    testPrisma = new PrismaClient({
      datasources: {
        db: {
          // Use SQLite in-memory database for tests if available
          // Otherwise fallback to test PostgreSQL database
          url:
            process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL
              ? process.env.TEST_DATABASE_URL
              : process.env.DATABASE_URL,
        },
      },
      log: [], // Disable logging in tests
    });
  }

  return testPrisma;
};

/**
 * Clean up test database connection
 */
export const disconnectTestDatabase = async (): Promise<void> => {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
};

/**
 * Reset test database to clean state
 */
export const resetTestDatabase = async (): Promise<void> => {
  const client = getTestPrismaClient();

  // Delete all data in reverse order to handle foreign key constraints
  await client.token.deleteMany();
  await client.user.deleteMany();
};
