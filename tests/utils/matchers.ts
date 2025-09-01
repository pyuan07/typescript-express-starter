/**
 * Custom Jest matchers for common test assertions
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidUUID(): R;
      toBeValidEmail(): R;
      toHaveValidTokenStructure(): R;
      toHaveValidUserStructure(): R;
    }
  }
}

// Extend Jest matchers
expect.extend({
  toBeValidDate(received: any) {
    const isValid = received instanceof Date || (typeof received === 'string' && !isNaN(Date.parse(received)));

    return {
      message: () => `expected ${received} to be a valid date`,
      pass: isValid,
    };
  },

  toBeValidUUID(received: any) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValid = typeof received === 'string' && uuidRegex.test(received);

    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass: isValid,
    };
  },

  toBeValidEmail(received: any) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = typeof received === 'string' && emailRegex.test(received);

    return {
      message: () => `expected ${received} to be a valid email`,
      pass: isValid,
    };
  },

  toHaveValidTokenStructure(received: any) {
    const hasValidStructure =
      received &&
      typeof received === 'object' &&
      typeof received.token === 'string' &&
      received.expires &&
      !isNaN(Date.parse(received.expires));

    return {
      message: () =>
        `expected ${JSON.stringify(received)} to have valid token structure with 'token' and 'expires' properties`,
      pass: hasValidStructure,
    };
  },

  toHaveValidUserStructure(received: any) {
    const hasValidStructure =
      received &&
      typeof received === 'object' &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      typeof received.email === 'string' &&
      typeof received.role === 'string' &&
      typeof received.isEmailVerified === 'boolean' &&
      received.createdAt &&
      received.updatedAt &&
      !received.password; // Should not contain password

    return {
      message: () => `expected ${JSON.stringify(received)} to have valid user structure`,
      pass: hasValidStructure,
    };
  },
});

export {};
