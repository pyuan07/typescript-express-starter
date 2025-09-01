import { disconnectTestDatabase, resetTestDatabase } from '../src/config/database.test';

export default async function globalTeardown() {
  console.log('🧹 Cleaning up test database...');

  try {
    // Clean up test data
    await resetTestDatabase();
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.warn('⚠️  Warning: Could not clean up test data:', error);
  } finally {
    await disconnectTestDatabase();
  }
}
