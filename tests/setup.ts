import dotenv from 'dotenv';
import { resetTestDatabase, getTestPrismaClient } from '../src/config/database.test';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test setup - clean database before each test file
beforeAll(async () => {
  try {
    // Clean up any existing test data
    await resetTestDatabase();
  } catch (error) {
    console.warn('Warning: Could not clean test data, tests may fail if database is not available:', error);
  }
});

// Clean up after each test to ensure isolation
afterEach(async () => {
  try {
    await resetTestDatabase();
  } catch (error) {
    // Ignore cleanup errors in individual tests
  }
});

// Global error handling for unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
