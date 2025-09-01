import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

export default async function globalSetup() {
  // Load test environment variables
  dotenv.config({ path: '.env.test' });

  console.log('🔧 Setting up test database...');

  // Ensure database schema is up to date
  try {
    execSync('npx prisma migrate dev --name test-setup', {
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
    });
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.log('ℹ️  Database already up to date');
  }

  // Test database connection
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('✅ Test database connection successful');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
