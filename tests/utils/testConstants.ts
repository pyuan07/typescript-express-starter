import { v4 as uuidv4 } from 'uuid';
import cuid from 'cuid';

// Valid IDs for testing (matching Prisma CUID format)
export const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
export const VALID_CUID = cuid();
export const NONEXISTENT_UUID = '123e4567-e89b-12d3-a456-426614174999';
export const NONEXISTENT_CUID = cuid(); // Generate a real CUID but won't exist in DB
export const INVALID_UUID = 'invalid-uuid-format';

// Use CUID format since that's what Prisma uses by default
export const NONEXISTENT_ID = NONEXISTENT_CUID;

// Generate random UUID for tests
export const generateTestUuid = (): string => uuidv4();

// Test emails
export const VALID_TEST_EMAIL = 'test@example.com';
export const INVALID_TEST_EMAIL = 'invalid-email';

// Common test values
export const TEST_PASSWORD = 'password123';
