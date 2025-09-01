# TypeScript REST API Starter

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

A modern, production-ready boilerplate for building RESTful APIs using TypeScript, Node.js, Express, and PostgreSQL.

This starter provides a solid foundation with TypeScript, JWT authentication, PostgreSQL database integration, comprehensive security measures, and modern development tools pre-configured.

## 🚀 Quick Start

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd typescript-starter
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and configuration
   ```

4. **Set up the database:**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Apply database schema
   npx prisma db push
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

📖 **Need more detailed setup instructions?** See [Getting Started Guide](docs/GETTING-STARTED.md)

## 📚 Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/GETTING-STARTED.md) | Detailed setup instructions and initial configuration |
| [Architecture Guide](docs/ARCHITECTURE.md) | Understanding the codebase structure and patterns |
| [API Development](docs/API-DEVELOPMENT.md) | Creating endpoints, validation, and business logic |
| [Adding New Entities](docs/ADDING-ENTITIES.md) | Step-by-step guide for adding new database models and APIs |
| [Testing Guide](docs/TESTING-GUIDE.md) | Writing unit and integration tests |
| [Deployment Guide](docs/DEPLOYMENT.md) | Production deployment with Docker and PM2 |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common issues and solutions |
| [Advanced Patterns](docs/ADVANCED-PATTERNS.md) | Advanced usage patterns and customizations |

## ✨ Key Features

### 🏗️ **Architecture & Database**
- **TypeScript**: Fully typed codebase with strict TypeScript configuration
- **PostgreSQL**: Modern SQL database with [Prisma ORM](https://prisma.io) for type-safe operations
- **Layered Architecture**: Clean separation of concerns (Routes → Controllers → Services → Database)

### 🔐 **Security & Authentication**
- **JWT Authentication**: Dual-token system (access + refresh) using [Passport.js](http://www.passportjs.org)
- **Role-based Authorization**: Fine-grained permissions system
- **Input Sanitization**: Protection against XSS and injection attacks
- **Security Headers**: Comprehensive security headers via [Helmet](https://helmetjs.github.io)
- **Rate Limiting**: Configurable rate limiting for different endpoints

### 🛠️ **Development Experience**
- **Request Validation**: Type-safe validation using [Zod](https://github.com/colinhacks/zod) schemas
- **Comprehensive Logging**: [Winston](https://github.com/winstonjs/winston) + [Morgan](https://github.com/expressjs/morgan) for detailed logging
- **Testing Framework**: Unit and integration tests with [Jest](https://jestjs.io)
- **API Documentation**: Auto-generated docs with [Swagger](https://swagger.io/)
- **Code Quality**: [ESLint](https://eslint.org) + [Prettier](https://prettier.io) + Git hooks

### 🚀 **Production Ready**
- **Process Management**: [PM2](https://pm2.keymetrics.io) for production deployment
- **Docker Support**: Multi-stage builds for development and production
- **Error Handling**: Centralized error handling with meaningful responses
- **Performance**: Compression, CORS, and optimization features

## 🎯 Essential Commands

### Development
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
npm run typecheck    # TypeScript type checking
```

### Database Operations
```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes to database
npm run db:migrate   # Create and apply migration
npm run db:studio    # Open Prisma Studio database GUI
npm run db:seed      # Run database seeding script
```

### Testing & Code Quality
```bash
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run lint         # Check code with ESLint
npm run lint:fix     # Fix auto-fixable ESLint issues
npm run prettier:fix # Fix code formatting
```

### Docker
```bash
docker-compose up    # Start all services
npm run docker:dev   # Development mode
npm run docker:prod  # Production mode
```

📖 **For complete command reference and advanced usage, see [Getting Started Guide](docs/GETTING-STARTED.md)**

## ⚙️ Environment Configuration

### Essential Variables
```bash
# Copy environment template
cp .env.example .env
```

**Required Configuration:**
```bash
# Database (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/database_name?schema=public"

# JWT Secret (CHANGE IN PRODUCTION!)
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Server
NODE_ENV=development
PORT=3000
```

**Optional Configuration:**
```bash
# JWT Token Expiration
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=30

# Email (for password reset functionality)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourapp.com
```

📖 **For complete environment setup guide, see [Getting Started Guide](docs/GETTING-STARTED.md)**

## 🏗️ Project Architecture

### Directory Structure
```
src/
├── config/           # Configuration files
│   ├── config.ts     # Environment variables with Zod validation
│   ├── database.ts   # Single Prisma client instance
│   ├── logger.ts     # Winston logging setup
│   ├── passport.ts   # JWT authentication strategy
│   └── roles.ts      # Role-based permissions
├── controllers/      # HTTP request handlers
├── middlewares/      # Express middlewares (auth, validation, etc.)
├── routes/v1/        # API route definitions
├── services/         # Business logic layer
├── utils/           # Utility functions
├── validations/     # Zod validation schemas
├── types/           # TypeScript type definitions
├── app.ts           # Express app configuration
└── index.ts         # Application entry point
```

### Layered Architecture
```
Request → Route → Middleware → Controller → Service → Database
                     ↓
                 Validation
                 Authentication  
                 Rate Limiting
```

📖 **For detailed architecture explanation, see [Architecture Guide](docs/ARCHITECTURE.md)**

## 📡 API Reference

### Interactive Documentation
Once the server is running, visit: **`http://localhost:3000/v1/docs`**

The API documentation is automatically generated using [Swagger](https://swagger.io/) definitions.

### Core Endpoints

#### Authentication
- `POST /v1/auth/register` - User registration
- `POST /v1/auth/login` - User login
- `POST /v1/auth/refresh-tokens` - Refresh authentication tokens
- `POST /v1/auth/forgot-password` - Send password reset email
- `POST /v1/auth/reset-password` - Reset password
- `POST /v1/auth/verify-email` - Verify email address

#### User Management
- `GET /v1/users` - Get all users (admin only)
- `GET /v1/users/:userId` - Get user by ID
- `PATCH /v1/users/:userId` - Update user
- `DELETE /v1/users/:userId` - Delete user

#### Health Check
- `GET /v1/health` - Health check endpoint

📖 **For API development guide, see [API Development Guide](docs/API-DEVELOPMENT.md)**

## 🛡️ Security & Error Handling

### Built-in Security Features
- **JWT Authentication**: Secure token-based authentication
- **Role-based Authorization**: Granular permission system
- **Input Sanitization**: Protection against XSS and injection attacks
- **Rate Limiting**: Configurable limits for different endpoints
- **Security Headers**: Comprehensive HTTP security headers
- **CORS Configuration**: Cross-origin resource sharing controls

### Centralized Error Handling

All errors are handled consistently using the `ApiError` class and `catchAsync` wrapper:

```typescript
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';
import httpStatus from 'http-status';

const controller = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  res.send(user);
});
```

**Error Response Format:**
```json
{
  "code": 404,
  "message": "User not found"
}
```

📖 **For detailed security and error handling patterns, see [API Development Guide](docs/API-DEVELOPMENT.md)**

## ✅ Request Validation

All API inputs are validated using [Zod](https://zod.dev/) schemas for type safety:

```typescript
// Define validation schema
const createUser = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1)
  })
};

// Apply validation in routes
router.post('/', 
  validate(userValidation.createUser), 
  userController.createUser
);
```

Validation schemas are located in `src/validations/` and provide:
- **Type Safety**: Compile-time and runtime type checking
- **Input Sanitization**: Automatic data cleaning and validation
- **Clear Error Messages**: User-friendly validation errors
- **Security**: Protection against malformed or malicious input

📖 **For validation patterns and examples, see [API Development Guide](docs/API-DEVELOPMENT.md)**

## 🧪 Testing

Comprehensive testing setup with [Jest](https://jestjs.io/) and TypeScript support.

### Test Structure
```
tests/
├── unit/              # Unit tests (services, utilities)
├── integration/       # API endpoint tests
├── fixtures/          # Test data and helpers
└── utils/            # Test utilities and setup
```

### Running Tests
```bash
npm test                # Run all tests
npm run test:watch      # Run in watch mode
npm run test:coverage   # Generate coverage report
npm run test:unit       # Run only unit tests
npm run test:integration # Run only integration tests
```

### Testing Features
- **Database Isolation**: Each test gets a clean database state
- **API Testing**: Full request/response testing with supertest
- **Fixtures**: Reusable test data and user tokens
- **Coverage Reports**: Detailed code coverage analysis
- **TypeScript Support**: Full type checking in tests

📖 **For complete testing guide and patterns, see [Testing Guide](docs/TESTING-GUIDE.md)**

## 🔐 Authentication System

### JWT Token Strategy
The starter uses a **dual-token approach** for enhanced security:

- **Access Token** (30 min) → Used for API requests
- **Refresh Token** (30 days) → Used to generate new access tokens

### Using Authentication

```typescript
// Protect routes with authentication
router.post('/users', auth(), userController.createUser);

// Require specific permissions
router.get('/admin', auth('manageUsers'), adminController.getUsers);

// Owner-only or admin access
router.patch('/users/:id', auth('getUsers'), userController.updateUser);
```

### Token Management

1. **Get Tokens**: Register or login to receive both tokens
2. **Use Access Token**: Include in Authorization header: `Bearer <token>`
3. **Refresh Tokens**: Use refresh token when access token expires
4. **Token Expiration**: Configurable via environment variables

### Authorization Header Format
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

📖 **For detailed authentication flows, see [API Development Guide](docs/API-DEVELOPMENT.md)**

## 🔒 Authorization System

### Role-Based Permissions

The authorization system uses roles and permissions defined in `src/config/roles.ts`:

- **USER Role**: Basic user permissions
- **ADMIN Role**: Full system access

### Permission Examples

```typescript
// Anyone authenticated can access
router.get('/profile', auth(), userController.getProfile);

// Only users with 'manageUsers' permission
router.get('/users', auth('manageUsers'), userController.getUsers);

// Only admins can access
router.delete('/users/:id', auth('manageUsers'), userController.deleteUser);
```

### Resource Ownership

Users can access their own resources, admins can access any:

```typescript
// Users can get/update their own data, admins can access any user's data
router.get('/users/:userId', auth('getUsers'), userController.getUser);
```

**Error Responses:**
- `401 Unauthorized` - No valid token provided
- `403 Forbidden` - Valid token but insufficient permissions

📖 **For detailed authorization patterns, see [API Development Guide](docs/API-DEVELOPMENT.md)**

## 📝 Logging

Comprehensive logging setup using [Winston](https://github.com/winstonjs/winston) and [Morgan](https://github.com/expressjs/morgan).

### Usage

```typescript
import logger from '../config/logger';

// Log levels (most to least important)
logger.error('Database connection failed');   // Level 0
logger.warn('API rate limit exceeded');       // Level 1
logger.info('User registered successfully');   // Level 2
logger.http('GET /v1/users - 200ms');         // Level 3
logger.verbose('Cache hit for user data');    // Level 4
logger.debug('Processing user validation');    // Level 5
```

### Environment-Based Logging

- **Development**: All log levels to console with colors
- **Production**: Only info, warn, error levels (PM2 handles file storage)
- **Test**: Minimal logging to avoid test output clutter

### Automatic Request Logging

All HTTP requests are automatically logged with:
- Request method and URL
- Response status code
- Response time
- User agent and IP (in development)

📖 **For advanced logging patterns, see [Advanced Patterns Guide](docs/ADVANCED-PATTERNS.md)**

## 🗃️ Database Operations

### Prisma ORM Benefits

This starter uses [Prisma](https://prisma.io) instead of Mongoose for type-safe database operations:

- **Type Safety**: Generated TypeScript types for all models
- **Auto-completion**: Full IDE support for queries and mutations
- **Query Builder**: Intuitive and powerful query interface
- **Migration System**: Version-controlled database schema changes
- **Introspection**: Generate schema from existing databases

### Common Patterns

```typescript
// Type-safe queries with Prisma
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, email: true, name: true } // Exclude sensitive fields
});

// Pagination with relationships
const users = await prisma.user.findMany({
  skip: (page - 1) * limit,
  take: limit,
  include: { tokens: true },
  orderBy: { createdAt: 'desc' }
});

// Transactions for complex operations
const result = await prisma.$transaction([
  prisma.user.create({ data: userData }),
  prisma.token.create({ data: tokenData })
]);
```

### Database Management

```bash
npm run db:studio    # Visual database browser
npm run db:seed      # Run seed scripts
npm run db:reset     # Reset database and apply migrations
```

📖 **For database patterns and Prisma usage, see [Architecture Guide](docs/ARCHITECTURE.md)**

## 🎨 Code Quality

### Linting & Formatting

Strict code quality enforcement using [ESLint](https://eslint.org/) and [Prettier](https://prettier.io):

- **ESLint Configuration**: Airbnb base + TypeScript + Security rules
- **Prettier Integration**: Consistent code formatting
- **EditorConfig**: Consistent settings across IDEs
- **Git Hooks**: Automatic formatting and linting on commit

### Quality Checks

```bash
npm run lint         # Check code style and potential issues
npm run lint:fix     # Automatically fix linting issues
npm run prettier:fix # Format code consistently
npm run typecheck    # TypeScript type checking
```

### Pre-commit Hooks

Automatically enforced before each commit:
- Code formatting with Prettier
- ESLint checks and auto-fixes
- TypeScript type checking
- Test execution (optional)

### Configuration Files

- `.eslintrc.json` - ESLint configuration
- `.prettierrc.json` - Prettier formatting rules
- `.editorconfig` - IDE settings
- `lint-staged.config.js` - Pre-commit hook configuration

📖 **For advanced code quality setup, see [Advanced Patterns Guide](docs/ADVANCED-PATTERNS.md)**

## 🤝 Contributing

Contributions are welcome! Please ensure:

1. **Code Quality**: Follow existing patterns and pass all linting checks
2. **Testing**: Add tests for new features and ensure all tests pass
3. **Documentation**: Update relevant documentation for changes
4. **Security**: Follow security best practices for any changes

### Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Configure your .env file

# 3. Set up database
npm run db:generate
npm run db:push

# 4. Run tests
npm test

# 5. Start development
npm run dev
```

All commits should pass the pre-commit hooks (linting, formatting, type checking).

## 🚀 What's Next?

Once you have the starter running, consider exploring:

1. **[Adding New Entities](docs/ADDING-ENTITIES.md)** - Step-by-step guide for adding new database models and APIs
2. **[Advanced Patterns](docs/ADVANCED-PATTERNS.md)** - Custom middleware, file uploads, background jobs
3. **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment with Docker and PM2
4. **[Testing Guide](docs/TESTING-GUIDE.md)** - Comprehensive testing strategies

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Zod Validation](https://zod.dev/)
- [Express.js Guide](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/)

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Documentation**: All guides are in the [`docs/`](docs/) directory

---

## License

[MIT](LICENSE)

**Happy coding! 🎉**
