# Testing Guide

Comprehensive guide for testing your TypeScript REST API with Jest, Supertest, and database isolation.

## 🧪 Testing Philosophy

This starter follows a comprehensive testing strategy:

- **Unit Tests**: Test individual functions in isolation
- **Integration Tests**: Test complete API endpoints and workflows
- **Database Isolation**: Each test gets a clean database state
- **Type Safety**: Full TypeScript support in tests
- **Fixtures**: Reusable test data and helpers

## 📁 Test Structure

```
tests/
├── fixtures/          # Test data and helpers
│   ├── user.fixture.ts    # User test data
│   ├── token.fixture.ts   # JWT test tokens
│   └── product.fixture.ts # Product test data (example)
├── utils/             # Test utilities
│   ├── setupTestDB.ts     # Database test setup
│   └── testConstants.ts   # Test constants
├── unit/              # Unit tests
│   └── services/          # Service layer tests
│       ├── auth.service.test.ts
│       ├── user.service.test.ts
│       └── product.service.test.ts
└── integration/       # Integration tests
    ├── auth.test.ts       # Authentication flow tests
    ├── user.test.ts       # User management tests
    └── product.test.ts    # Product API tests
```

## 🛠️ Test Environment Setup

### Database Configuration

The test environment uses a separate database to avoid interfering with development data.

**`.env.test` Configuration:**
```env
NODE_ENV=test
DATABASE_URL="postgresql://username:password@localhost:5432/test_database?schema=public"
JWT_SECRET="test-jwt-secret"
```

**Global Test Setup `tests/utils/setupTestDB.ts`:**
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const setupTestDB = () => {
  beforeAll(async () => {
    // Connect to test database
    await prisma.$connect();
  });

  beforeEach(async () => {
    // Clean database before each test
    await clearDatabase();
  });

  afterAll(async () => {
    // Clean up and disconnect
    await clearDatabase();
    await prisma.$disconnect();
  });
};

const clearDatabase = async () => {
  // Clear all tables in correct order (respecting foreign keys)
  await prisma.token.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
};

export default setupTestDB;
```

### Test Constants

**`tests/utils/testConstants.ts`:**
```typescript
export const INVALID_UUID = 'invalid-uuid';
export const NONEXISTENT_ID = '507f1f77bcf86cd799439011';
export const TEST_TIMEOUT = 10000; // 10 seconds
```

## 🎭 Test Fixtures

Fixtures provide consistent test data and helper functions.

### User Fixtures

**`tests/fixtures/user.fixture.ts`:**
```typescript
import { User, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const userOne: Partial<User> = {
  name: 'Test User One',
  email: 'user1@example.com',
  password: 'password123',
  role: Role.USER,
  isEmailVerified: true,
};

const userTwo: Partial<User> = {
  name: 'Test User Two',
  email: 'user2@example.com',
  password: 'password123',
  role: Role.USER,
  isEmailVerified: true,
};

const admin: Partial<User> = {
  name: 'Admin User',
  email: 'admin@example.com',
  password: 'password123',
  role: Role.ADMIN,
  isEmailVerified: true,
};

/**
 * Insert users into test database
 */
const insertUsers = async (users: Partial<User>[]): Promise<User[]> => {
  const createdUsers = await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password || 'password123', 8);
      return prisma.user.create({
        data: {
          ...user,
          password: hashedPassword,
        } as User,
      });
    })
  );
  
  return createdUsers;
};

export { userOne, userTwo, admin, insertUsers };
```

### Token Fixtures

**`tests/fixtures/token.fixture.ts`:**
```typescript
import moment from 'moment';
import jwt from 'jsonwebtoken';
import config from '../../src/config/config';
import { tokenService } from '../../src/services';
import { userOne, userTwo, admin } from './user.fixture';

// Generate access tokens for test users
const userOneAccessToken = jwt.sign(
  { sub: 'user-one-id', iat: moment().unix() },
  config.jwt.secret,
  { expiresIn: config.jwt.accessExpirationMinutes + 'm' }
);

const userTwoAccessToken = jwt.sign(
  { sub: 'user-two-id', iat: moment().unix() },
  config.jwt.secret,
  { expiresIn: config.jwt.accessExpirationMinutes + 'm' }
);

const adminAccessToken = jwt.sign(
  { sub: 'admin-id', iat: moment().unix() },
  config.jwt.secret,
  { expiresIn: config.jwt.accessExpirationMinutes + 'm' }
);

/**
 * Generate auth tokens for a user
 */
const generateAuthTokens = async (userId: string) => {
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = tokenService.generateToken(userId, accessTokenExpires, 'ACCESS');

  const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');
  const refreshToken = tokenService.generateToken(userId, refreshTokenExpires, 'REFRESH');

  await tokenService.saveToken(refreshToken, userId, refreshTokenExpires, 'REFRESH');

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate(),
    },
  };
};

export {
  userOneAccessToken,
  userTwoAccessToken, 
  adminAccessToken,
  generateAuthTokens,
};
```

### Product Fixtures (Example)

**`tests/fixtures/product.fixture.ts`:**
```typescript
import { Product } from '@prisma/client';

const productOne: Partial<Product> = {
  name: 'Test Product 1',
  price: 99.99,
  description: 'Test product description',
  category: 'Electronics',
  inStock: true,
};

const productTwo: Partial<Product> = {
  name: 'Test Product 2',
  price: 149.99,
  description: 'Another test product',
  category: 'Clothing',
  inStock: false,
};

export { productOne, productTwo };
```

## 🏗️ Unit Testing

Unit tests focus on individual functions, typically in the service layer.

### Service Unit Tests Example

**`tests/unit/services/user.service.test.ts`:**
```typescript
import { PrismaClient } from '@prisma/client';
import userService from '../../../src/services/user.service';
import { userOne, admin, insertUsers } from '../../fixtures/user.fixture';
import setupTestDB from '../../utils/setupTestDB';
import { NONEXISTENT_ID, INVALID_UUID } from '../../utils/testConstants';
import ApiError from '../../../src/utils/ApiError';

setupTestDB();

describe('User service', () => {
  describe('createUser', () => {
    test('should create a user', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      const user = await userService.createUser(userData);

      expect(user).toHaveProperty('id');
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.password).not.toBe(userData.password); // Should be hashed
      expect(user.role).toBe('USER'); // Default role
      expect(user.isEmailVerified).toBe(false); // Default value
    });

    test('should throw error if email is already taken', async () => {
      await insertUsers([userOne]);
      
      const userData = {
        name: 'Jane Doe',
        email: userOne.email!, // Same email
        password: 'password123',
      };

      await expect(userService.createUser(userData)).rejects.toThrow('Email already taken');
    });

    test('should hash password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      const user = await userService.createUser(userData);
      
      expect(user.password).not.toBe(userData.password);
      expect(user.password.length).toBeGreaterThan(50); // bcrypt hash length
    });
  });

  describe('getUserById', () => {
    test('should return user if found', async () => {
      const [createdUser] = await insertUsers([userOne]);

      const user = await userService.getUserById(createdUser.id);

      expect(user).toBeDefined();
      expect(user?.id).toBe(createdUser.id);
      expect(user?.email).toBe(userOne.email);
    });

    test('should return null if user not found', async () => {
      const user = await userService.getUserById(NONEXISTENT_ID);
      expect(user).toBeNull();
    });

    test('should throw error for invalid ID format', async () => {
      await expect(userService.getUserById(INVALID_UUID)).rejects.toThrow('Invalid user ID format');
    });
  });

  describe('updateUserById', () => {
    test('should update user successfully', async () => {
      const [createdUser] = await insertUsers([userOne]);
      const updateBody = { name: 'Updated Name', email: 'updated@example.com' };

      const updatedUser = await userService.updateUserById(createdUser.id, updateBody);

      expect(updatedUser.name).toBe(updateBody.name);
      expect(updatedUser.email).toBe(updateBody.email);
      expect(updatedUser.id).toBe(createdUser.id);
    });

    test('should throw error if user not found', async () => {
      const updateBody = { name: 'Updated Name' };
      
      await expect(userService.updateUserById(NONEXISTENT_ID, updateBody)).rejects.toThrow('User not found');
    });

    test('should throw error if email is already taken', async () => {
      const [user1, user2] = await insertUsers([userOne, admin]);
      const updateBody = { email: admin.email };

      await expect(userService.updateUserById(user1.id, updateBody)).rejects.toThrow('Email already taken');
    });
  });

  describe('deleteUserById', () => {
    test('should delete user successfully', async () => {
      const [createdUser] = await insertUsers([userOne]);

      await userService.deleteUserById(createdUser.id);

      const deletedUser = await userService.getUserById(createdUser.id);
      expect(deletedUser).toBeNull();
    });

    test('should throw error if user not found', async () => {
      await expect(userService.deleteUserById(NONEXISTENT_ID)).rejects.toThrow('User not found');
    });
  });
});
```

### Testing Patterns

**Arrange-Act-Assert Pattern:**
```typescript
test('should create user with valid data', async () => {
  // Arrange: Set up test data
  const userData = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
  };

  // Act: Execute the function
  const user = await userService.createUser(userData);

  // Assert: Verify the results
  expect(user).toMatchObject({
    name: userData.name,
    email: userData.email,
  });
  expect(user).toHaveProperty('id');
  expect(user.password).not.toBe(userData.password);
});
```

**Testing Error Scenarios:**
```typescript
describe('error scenarios', () => {
  test('should handle database connection errors', async () => {
    // Mock database failure
    jest.spyOn(prisma.user, 'create').mockRejectedValue(new Error('DB Connection Error'));
    
    const userData = { name: 'Test', email: 'test@example.com', password: 'pass123' };
    
    await expect(userService.createUser(userData)).rejects.toThrow();
  });

  test('should validate input parameters', async () => {
    await expect(userService.getUserById('')).rejects.toThrow('Invalid user ID format');
    await expect(userService.getUserById('invalid-uuid')).rejects.toThrow('Invalid user ID format');
  });
});
```

## 🌐 Integration Testing

Integration tests verify complete API endpoints and workflows.

### API Endpoint Tests

**`tests/integration/auth.test.ts`:**
```typescript
import request from 'supertest';
import httpStatus from 'http-status';
import app from '../../src/app';
import setupTestDB from '../utils/setupTestDB';
import { userOne, insertUsers } from '../fixtures/user.fixture';
import { generateAuthTokens } from '../fixtures/token.fixture';

setupTestDB();

describe('Auth routes', () => {
  describe('POST /v1/auth/register', () => {
    test('should return 201 and create new user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      const res = await request(app)
        .post('/v1/auth/register')
        .send(userData)
        .expect(httpStatus.CREATED);

      expect(res.body.user).toMatchObject({
        name: userData.name,
        email: userData.email,
        role: 'USER',
        isEmailVerified: false,
      });
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.tokens).toMatchObject({
        access: { token: expect.any(String), expires: expect.any(String) },
        refresh: { token: expect.any(String), expires: expect.any(String) },
      });
    });

    test('should return 400 error if email is invalid', async () => {
      const userData = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123',
      };

      await request(app)
        .post('/v1/auth/register')
        .send(userData)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if email is already used', async () => {
      await insertUsers([userOne]);
      
      const userData = {
        name: 'Test User',
        email: userOne.email,
        password: 'password123',
      };

      await request(app)
        .post('/v1/auth/register')
        .send(userData)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password length is less than 8 characters', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'pass',
      };

      await request(app)
        .post('/v1/auth/register')
        .send(userData)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/auth/login', () => {
    test('should return 200 and login user', async () => {
      const [user] = await insertUsers([userOne]);
      const loginCredentials = {
        email: userOne.email,
        password: userOne.password,
      };

      const res = await request(app)
        .post('/v1/auth/login')
        .send(loginCredentials)
        .expect(httpStatus.OK);

      expect(res.body.user).toMatchObject({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      });
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.tokens).toMatchObject({
        access: { token: expect.any(String), expires: expect.any(String) },
        refresh: { token: expect.any(String), expires: expect.any(String) },
      });
    });

    test('should return 401 error if credentials are invalid', async () => {
      const loginCredentials = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      };

      await request(app)
        .post('/v1/auth/login')
        .send(loginCredentials)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/auth/refresh-tokens', () => {
    test('should return 200 and new auth tokens', async () => {
      const [user] = await insertUsers([userOne]);
      const tokens = await generateAuthTokens(user.id);

      const res = await request(app)
        .post('/v1/auth/refresh-tokens')
        .send({ refreshToken: tokens.refresh.token })
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        access: { token: expect.any(String), expires: expect.any(String) },
        refresh: { token: expect.any(String), expires: expect.any(String) },
      });
    });

    test('should return 401 error if refresh token is invalid', async () => {
      await request(app)
        .post('/v1/auth/refresh-tokens')
        .send({ refreshToken: 'invalid-token' })
        .expect(httpStatus.UNAUTHORIZED);
    });
  });
});
```

### Complex Integration Tests

**Testing with Authentication:**
```typescript
describe('Protected routes', () => {
  test('should return 200 if access token is valid', async () => {
    const [user] = await insertUsers([userOne]);
    const tokens = await generateAuthTokens(user.id);

    await request(app)
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${tokens.access.token}`)
      .expect(httpStatus.OK);
  });

  test('should return 401 if access token is invalid', async () => {
    await request(app)
      .get('/v1/users/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(httpStatus.UNAUTHORIZED);
  });

  test('should return 401 if no access token is provided', async () => {
    await request(app)
      .get('/v1/users/me')
      .expect(httpStatus.UNAUTHORIZED);
  });
});
```

**Testing Pagination and Filtering:**
```typescript
describe('GET /v1/products', () => {
  beforeEach(async () => {
    // Create test products
    const [user] = await insertUsers([userOne]);
    
    for (let i = 0; i < 15; i++) {
      await request(app)
        .post('/v1/products')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({
          name: `Product ${i}`,
          price: 99.99 + i,
          category: i % 2 === 0 ? 'Electronics' : 'Clothing',
          inStock: i % 3 !== 0,
        });
    }
  });

  test('should apply pagination correctly', async () => {
    const res = await request(app)
      .get('/v1/products')
      .query({ page: 2, limit: 5 })
      .expect(httpStatus.OK);

    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(5);
    expect(res.body.results).toHaveLength(5);
    expect(res.body.totalPages).toBe(3);
    expect(res.body.totalResults).toBe(15);
  });

  test('should filter by category', async () => {
    const res = await request(app)
      .get('/v1/products')
      .query({ category: 'Electronics' })
      .expect(httpStatus.OK);

    expect(res.body.results.length).toBeGreaterThan(0);
    res.body.results.forEach((product: any) => {
      expect(product.category).toBe('Electronics');
    });
  });

  test('should sort products correctly', async () => {
    const res = await request(app)
      .get('/v1/products')
      .query({ sortBy: 'price:asc' })
      .expect(httpStatus.OK);

    const prices = res.body.results.map((product: any) => product.price);
    const sortedPrices = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sortedPrices);
  });
});
```

## 🎯 Testing Best Practices

### 1. Test Isolation

```typescript
// ✅ Good: Each test is independent
describe('User service', () => {
  beforeEach(async () => {
    // Clean database before each test
    await clearDatabase();
  });

  test('should create user', async () => {
    // Test creates its own data
    const userData = { name: 'Test', email: 'test@example.com' };
    const user = await userService.createUser(userData);
    expect(user).toBeDefined();
  });
});

// ❌ Bad: Tests depend on each other
describe('User service', () => {
  let createdUserId: string;

  test('should create user', async () => {
    const user = await userService.createUser(userData);
    createdUserId = user.id; // Other tests depend on this
  });

  test('should get user', async () => {
    const user = await userService.getUserById(createdUserId); // Depends on previous test
  });
});
```

### 2. Meaningful Test Names

```typescript
// ✅ Good: Descriptive test names
test('should return 400 error when email is invalid format', async () => {});
test('should create user with default role when role not specified', async () => {});
test('should throw ApiError when user not found', async () => {});

// ❌ Bad: Vague test names
test('should work', async () => {});
test('error case', async () => {});
test('user creation', async () => {});
```

### 3. Test Edge Cases

```typescript
describe('getUserById', () => {
  test('should return user when ID is valid', async () => {
    // Happy path
  });

  test('should return null when user not found', async () => {
    // Edge case: non-existent user
  });

  test('should throw error when ID format is invalid', async () => {
    // Edge case: invalid UUID
  });

  test('should throw error when ID is empty string', async () => {
    // Edge case: empty input
  });

  test('should throw error when ID is null', async () => {
    // Edge case: null input
  });
});
```

### 4. Mock External Dependencies

```typescript
// Mock external services
jest.mock('../../../src/services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
}));

describe('Auth service', () => {
  test('should send verification email after registration', async () => {
    const userData = { name: 'Test', email: 'test@example.com', password: 'pass123' };
    
    await authService.register(userData);
    
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      userData.email,
      expect.any(String) // verification token
    );
  });
});
```

## ⚡ Running Tests

### Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should create user"

# Run tests with verbose output
npm test -- --verbose

# Run tests for specific directory
npm test tests/unit

# Debug tests
npm test -- --detectOpenHandles --forceExit
```

### Test Configuration

**`jest.config.js`:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/app.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
  testTimeout: 10000,
};
```

### Coverage Reports

```bash
# Generate and view coverage report
npm run test:coverage
open coverage/lcov-report/index.html
```

**Coverage Goals:**
- **Lines**: > 90%
- **Functions**: > 90%
- **Branches**: > 80%
- **Statements**: > 90%

## 🚨 Common Testing Issues

### Database Issues

```typescript
// Problem: Tests interfering with each other
// Solution: Proper test isolation
beforeEach(async () => {
  await clearDatabase();
});

// Problem: Test database not found
// Solution: Check .env.test configuration
DATABASE_URL="postgresql://user:pass@localhost:5432/test_db?schema=public"

// Problem: Prisma client connection issues
// Solution: Proper cleanup
afterAll(async () => {
  await prisma.$disconnect();
});
```

### Async/Await Issues

```typescript
// ✅ Good: Proper async/await
test('should create user', async () => {
  const user = await userService.createUser(userData);
  expect(user).toBeDefined();
});

// ❌ Bad: Missing await
test('should create user', async () => {
  const user = userService.createUser(userData); // Missing await
  expect(user).toBeDefined(); // Will fail
});
```

### Token/Authentication Issues

```typescript
// ✅ Good: Use proper fixtures
import { userOneAccessToken } from '../fixtures/token.fixture';

test('should access protected route', async () => {
  await request(app)
    .get('/v1/users/me')
    .set('Authorization', `Bearer ${userOneAccessToken}`)
    .expect(httpStatus.OK);
});

// ❌ Bad: Hardcoded tokens
test('should access protected route', async () => {
  await request(app)
    .get('/v1/users/me')
    .set('Authorization', 'Bearer fake-token') // Will fail
    .expect(httpStatus.OK);
});
```

## 📊 Test Metrics

Monitor these testing metrics:

- **Test Coverage**: Aim for >90% line coverage
- **Test Speed**: Unit tests <100ms, Integration tests <1s
- **Test Reliability**: Tests should pass consistently
- **Test Maintainability**: Easy to understand and modify

## ✅ Testing Checklist

For each new feature:

- [ ] **Unit tests** for all service layer functions
- [ ] **Integration tests** for all API endpoints
- [ ] **Error scenario tests** for edge cases
- [ ] **Authentication tests** for protected routes
- [ ] **Validation tests** for input validation
- [ ] **Database tests** for data persistence
- [ ] **Performance tests** for critical paths
- [ ] **Coverage check** meets minimum thresholds

---

**Next: Learn about deployment in the [Deployment Guide](DEPLOYMENT.md)**