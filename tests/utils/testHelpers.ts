import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate fake user data
 */
export const generateFakeUser = (overrides: any = {}) => ({
  name: faker.person.fullName(),
  email: faker.internet.email().toLowerCase(),
  password: 'Password123!',
  role: 'USER' as const,
  isEmailVerified: false,
  ...overrides,
});

/**
 * Generate multiple fake users
 */
export const generateFakeUsers = (count: number, overrides: any = {}) => {
  return Array.from({ length: count }, () => generateFakeUser(overrides));
};

/**
 * Clean up all test data
 */
export const cleanupTestData = async () => {
  await prisma.token.deleteMany();
  await prisma.user.deleteMany();
};

/**
 * Wait for a specified amount of time
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extract error message from response
 */
export const extractErrorMessage = (response: any) => {
  if (response.body?.message) {
    return response.body.message;
  }
  if (response.body?.error) {
    return response.body.error;
  }
  return response.body;
};

/**
 * Generate random UUID v4
 */
export const generateUUID = () => {
  return faker.string.uuid();
};

/**
 * Generate random email
 */
export const generateEmail = () => {
  return faker.internet.email().toLowerCase();
};

/**
 * Generate random password that meets requirements
 */
export const generatePassword = () => {
  return faker.internet.password({ length: 12, pattern: /[a-zA-Z0-9]/ });
};

/**
 * Get user count in database
 */
export const getUserCount = async () => {
  return await prisma.user.count();
};

/**
 * Get token count in database
 */
export const getTokenCount = async () => {
  return await prisma.token.count();
};

/**
 * Check if email exists in database
 */
export const emailExists = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  return !!user;
};

/**
 * Get user by email
 */
export const findUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({ where: { email } });
};

/**
 * Create test environment variables
 */
export const setupTestEnv = () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://admin:Admin123!@localhost:5432/test?schema=public';
  process.env.JWT_ACCESS_EXPIRATION_MINUTES = '30';
  process.env.JWT_REFRESH_EXPIRATION_DAYS = '30';
  process.env.JWT_RESET_PASSWORD_EXPIRATION_MINUTES = '10';
  process.env.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES = '10';
};
