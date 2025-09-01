# Getting Started Guide

This comprehensive guide will walk you through setting up and understanding this TypeScript REST API starter project.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download here](https://postgresql.org/download/)
- **npm** (comes with Node.js)
- **Git** - [Download here](https://git-scm.com/)

### Optional but Recommended:
- **Docker & Docker Compose** - [Install Docker](https://docs.docker.com/get-docker/)
- **VS Code** - [Download here](https://code.visualstudio.com/)
- **Postman or Thunder Client** - For API testing

## 🛠️ Initial Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/pyuan07/typescript-express-starter.git
cd typescript-express-starter

# Install dependencies
npm install

# Verify installation
npm run typecheck
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Open .env and configure your settings
```

**Essential `.env` Configuration:**
```env
# Database - Replace with your PostgreSQL credentials
DATABASE_URL="postgresql://username:password@localhost:5432/your_database_name?schema=public"

# JWT Secret - CHANGE THIS IN PRODUCTION!
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Server Configuration
NODE_ENV=development
PORT=3000

# Email Configuration (Optional - for password reset features)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourapp.com
```

### 3. Database Setup

**Option A: Local PostgreSQL**
```bash
# Create your database (using psql or pgAdmin)
createdb your_database_name

# Generate Prisma client
npm run db:generate

# Apply database schema
npm run db:push

# Optional: View database in browser
npm run db:studio
```

**Option B: Docker PostgreSQL**
```bash
# Start PostgreSQL with Docker
docker-compose up postgres -d

# Use this DATABASE_URL in .env:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/typescript_starter_db?schema=public"

# Apply schema
npm run db:generate
npm run db:push
```

### 4. Start Development

```bash
# Start development server
npm run dev

# Server will be available at http://localhost:3000
```

## 🔍 Verification

### Test the API

1. **Health Check:**
   ```bash
   curl http://localhost:3000/v1/health
   ```

2. **Register a User:**
   ```bash
   curl -X POST http://localhost:3000/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
   ```

3. **View API Documentation:**
   Open `http://localhost:3000/v1/docs` in your browser

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test types
npm run test:unit
npm run test:integration
```

### Code Quality Checks

```bash
# TypeScript compilation
npm run typecheck

# Linting
npm run lint

# Code formatting
npm run prettier:fix
```

## 📁 Project Structure Overview

```
typescript-starter/
├── src/                    # Source code
│   ├── config/            # Configuration files
│   ├── controllers/       # HTTP request handlers
│   ├── middlewares/       # Express middlewares
│   ├── routes/v1/         # API route definitions
│   ├── services/          # Business logic layer
│   ├── utils/            # Utility functions
│   ├── validations/      # Zod validation schemas
│   └── types/            # TypeScript type definitions
├── tests/                 # Test files
├── prisma/               # Database schema and migrations
├── docs/                 # Documentation
├── docker-compose.yml    # Docker configuration
└── package.json         # Project dependencies and scripts
```

## 🎯 Essential Commands Reference

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
npm run db:reset     # Reset database and apply migrations
```

### Testing & Code Quality
```bash
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:unit    # Run only unit tests
npm run test:integration # Run only integration tests
npm run lint         # Check code with ESLint
npm run lint:fix     # Fix auto-fixable ESLint issues
npm run prettier     # Check code formatting
npm run prettier:fix # Fix code formatting
```

### Docker
```bash
docker-compose up    # Start all services
docker-compose up postgres -d # Start only PostgreSQL
npm run docker:dev   # Development mode
npm run docker:prod  # Production mode
```

## 🚀 Next Steps

Now that you have the starter running, you can:

1. **Explore the API**: Visit `http://localhost:3000/v1/docs` for interactive documentation
2. **Learn the Architecture**: Read the [Architecture Guide](ARCHITECTURE.md)
3. **Add New Features**: Follow the [Adding New Entities Guide](ADDING-ENTITIES.md)
4. **Write Tests**: Check out the [Testing Guide](TESTING-GUIDE.md)
5. **Deploy**: When ready, see the [Deployment Guide](DEPLOYMENT.md)

## 🆘 Troubleshooting

### Common Issues

**Database Connection Error:**
```bash
# Check if PostgreSQL is running
pg_ctl status

# Check DATABASE_URL format
# Should be: postgresql://username:password@localhost:5432/database_name?schema=public
```

**Port Already in Use:**
```bash
# Check what's using port 3000
lsof -i :3000

# Change port in .env file
PORT=3001
```

**JWT Token Issues:**
```bash
# Verify JWT_SECRET is set in .env
echo $JWT_SECRET

# JWT_SECRET should be a strong, random string
```

**TypeScript Compilation Errors:**
```bash
# Run type checking to see specific errors
npm run typecheck

# Check tsconfig.json paths configuration
# Ensure all imports use correct path mapping
```

**Tests Failing:**
```bash
# Make sure test database is set up
# Check .env.test file exists and is configured properly
# DATABASE_URL should point to a test database

# Run tests individually to isolate issues
npm test -- --testPathPattern=specific.test.ts
```

### Getting Help

- Check other guides in the [docs/](../) directory
- Review the [Troubleshooting Guide](TROUBLESHOOTING.md)
- Look at existing issues in the repository
- Create a new issue if you find a bug or need help

---

**Ready to start building? Check out the [API Development Guide](API-DEVELOPMENT.md) to create your first endpoint!**