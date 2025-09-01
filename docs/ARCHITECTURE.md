# Architecture Guide

Understanding the structure and patterns of this TypeScript REST API starter.

## 🏗️ High-Level Architecture

This starter follows a **layered architecture pattern** with clear separation of concerns:

```
Request → Route → Middleware → Controller → Service → Database
                     ↓
                 Validation
                 Authentication  
                 Rate Limiting
                 Error Handling
```

## 📁 Directory Structure

```
src/
├── config/           # Configuration files
│   ├── config.ts     # Environment variables with Zod validation
│   ├── database.ts   # Single Prisma client instance
│   ├── logger.ts     # Winston logging setup
│   ├── morgan.ts     # HTTP request logging
│   ├── passport.ts   # JWT authentication strategy
│   └── roles.ts      # Role-based permissions
├── controllers/      # HTTP request handlers
├── middlewares/      # Express middlewares
├── routes/v1/        # API route definitions
├── services/         # Business logic layer
├── utils/           # Utility functions
├── validations/     # Zod validation schemas
├── types/           # TypeScript type definitions
├── app.ts           # Express app configuration
└── index.ts         # Application entry point
```

## 🔄 Request Flow

### 1. Request Entry
- **Entry Point**: `src/index.ts` starts the server
- **App Configuration**: `src/app.ts` sets up Express with middleware
- **Route Registration**: Routes are registered in `src/routes/v1/index.ts`

### 2. Middleware Stack (Order Matters!)

```typescript
// src/app.ts middleware order:
1. Morgan logging (if not test environment)
2. Helmet security headers
3. JSON/URL-encoded body parsing
4. Input sanitization middleware (custom, comprehensive)
5. Compression
6. CORS
7. Passport initialization
8. Rate limiting (production only)
9. API routes
10. 404 handler
11. Error converter and handler
```

### 3. Route Processing

```typescript
// Example route definition
router.post(
  '/users',
  auth('manageUsers'),              // 1. Authentication & Authorization
  validate(userValidation.createUser), // 2. Request Validation
  userController.createUser         // 3. Controller Handler
);
```

### 4. Controller Layer

Controllers handle HTTP-specific logic:

```typescript
const createUser = catchAsync(async (req: Request, res: Response) => {
  // Extract data from request
  const userData = req.body;
  const userId = req.user.id; // From auth middleware
  
  // Call service layer
  const user = await userService.createUser(userData);
  
  // Return HTTP response
  res.status(httpStatus.CREATED).send(user);
});
```

### 5. Service Layer

Services contain business logic and database operations:

```typescript
const createUser = async (userBody: CreateUserData): Promise<User> => {
  // Business logic validation
  if (await prisma.user.findUnique({ where: { email: userBody.email } })) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(userBody.password, 8);
  
  // Database operation
  return prisma.user.create({
    data: {
      ...userBody,
      password: hashedPassword,
    },
  });
};
```

## 🗄️ Database Layer

### Prisma ORM Integration

**Single Global Instance:**
```typescript
// src/config/database.ts
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export default prisma;
```

**Key Benefits:**
- **Type Safety**: Generated TypeScript types for all database models
- **Auto-completion**: Full IDE support for queries and mutations  
- **Query Builder**: Intuitive and powerful query interface
- **Migration System**: Version-controlled database schema changes
- **Introspection**: Generate schema from existing databases

### Database Schema

**Core Models:**

```prisma
// User model with authentication
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  password        String
  name            String
  role            Role      @default(USER)
  isEmailVerified Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  tokens          Token[]

  @@map("users")
}

// Token model for JWT management
model Token {
  id          String    @id @default(cuid())
  token       String
  type        TokenType
  expires     DateTime
  blacklisted Boolean   @default(false)
  createdAt   DateTime  @default(now())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("tokens")
}

enum Role {
  USER
  ADMIN
}

enum TokenType {
  ACCESS
  REFRESH
  RESET_PASSWORD
  VERIFY_EMAIL
}
```

## 🔐 Authentication & Authorization

### JWT Strategy

**Dual-Token System:**
- **Access Token** (30 min): Used for API requests
- **Refresh Token** (30 days): Used to generate new access tokens

**Token Flow:**
```typescript
// 1. User logs in
POST /v1/auth/login
→ Returns { accessToken, refreshToken }

// 2. Use access token for API calls
GET /v1/users (Authorization: Bearer <accessToken>)

// 3. When access token expires, refresh
POST /v1/auth/refresh-tokens { refreshToken }
→ Returns new { accessToken, refreshToken }
```

### Passport.js Configuration

```typescript
// src/config/passport.ts
const jwtStrategy = new JwtStrategy(
  {
    secretOrKey: config.jwt.secret,
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  },
  async (payload, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub }
      });
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  }
);
```

### Role-Based Authorization

```typescript
// src/config/roles.ts
const allRoles = {
  user: [],
  admin: ['getUsers', 'manageUsers'],
};

const roleRights = new Map(Object.entries(allRoles));

// Usage in auth middleware
const auth = (...requiredRights: string[]) => async (req, res, next) => {
  // Verify JWT token
  // Check if user has required permissions
  // Allow access or throw 403 Forbidden
};
```

## 🛡️ Security Architecture

### Input Validation & Sanitization

**Zod Validation Schemas:**
```typescript
// src/validations/user.validation.ts
const createUser = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1).max(50),
  }),
};
```

**Custom Sanitization Middleware:**
```typescript
// src/middlewares/sanitize.ts
// Removes potentially dangerous characters
// Prevents XSS and injection attacks
// Applied to all incoming requests
```

### Security Headers

```typescript
// Helmet configuration in app.ts
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      // ... more CSP rules
    },
  },
}));
```

### Rate Limiting

```typescript
// Different limits for different endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs for auth endpoints
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 100, // 100 requests per windowMs for general endpoints
});
```

## 🎯 Error Handling Architecture

### Centralized Error Handling

**ApiError Class:**
```typescript
class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
```

**Error Flow:**
```typescript
// 1. Service throws ApiError
throw new ApiError(httpStatus.NOT_FOUND, 'User not found');

// 2. catchAsync wrapper catches it
const controller = catchAsync(async (req, res) => {
  // Any thrown error is caught automatically
});

// 3. Error handler middleware processes it
// 4. Consistent error response sent to client
{
  "code": 404,
  "message": "User not found"
}
```

## 🧪 Testing Architecture

### Test Structure

```
tests/
├── fixtures/          # Test data and helpers
│   ├── user.fixture.ts    # User test data
│   └── token.fixture.ts   # JWT test tokens
├── utils/             # Test utilities
│   ├── setupTestDB.ts     # Database test setup
│   └── testConstants.ts   # Test constants
├── unit/              # Unit tests
│   └── services/          # Service layer tests
└── integration/       # API endpoint tests
    └── auth.test.ts       # Authentication flow tests
```

### Test Database Isolation

```typescript
// tests/utils/setupTestDB.ts
// Each test file gets a clean database state
// Automatic cleanup after tests
// Separate test database configuration
```

## 📊 Logging Architecture

### Winston + Morgan Integration

**Structured Logging:**
```typescript
// src/config/logger.ts
const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});
```

**HTTP Request Logging:**
```typescript
// src/config/morgan.ts
// Logs all HTTP requests with:
// - Method and URL
// - Status code and response time
// - User agent and IP (in development)
```

## 🚀 Performance Considerations

### Database Optimization

**Query Optimization:**
```typescript
// Use select to limit returned fields
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true } // Exclude sensitive fields
});

// Use include for necessary relationships only
const userWithTokens = await prisma.user.findUnique({
  where: { id },
  include: { tokens: true }
});
```

**Pagination Patterns:**
```typescript
const queryUsers = async (filter: any, options: any) => {
  const { page, limit } = validatePagination(options.page, options.limit);
  const skip = (page - 1) * limit;

  const [totalResults, results] = await Promise.all([
    prisma.user.count({ where: filter }),
    prisma.user.findMany({
      where: filter,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return { results, page, limit, totalPages: Math.ceil(totalResults / limit), totalResults };
};
```

## 🔧 Configuration Management

### Environment-Based Config

```typescript
// src/config/config.ts
const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.DATABASE_URL,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },
};
```

**Zod Validation for Environment Variables:**
```typescript
const envVarsSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  // ... more validations
});
```

This architecture provides a solid, scalable foundation for building REST APIs with TypeScript, focusing on security, maintainability, and developer experience.

---

**Next: Learn how to build on this architecture in the [API Development Guide](API-DEVELOPMENT.md)**