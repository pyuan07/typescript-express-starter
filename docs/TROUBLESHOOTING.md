# Troubleshooting Guide

Common issues and solutions when working with the TypeScript REST API starter.

## 🚨 Database Issues

### Database Connection Errors

**Problem:** `Error: Can't reach database server`
```
Error: Can't reach database server at `localhost`:`5432`
Please make sure your database server is running at `localhost`:`5432`.
```

**Solutions:**
```bash
# 1. Check if PostgreSQL is running
pg_ctl status

# On macOS with Homebrew
brew services list | grep postgresql
brew services start postgresql

# On Ubuntu/Debian
sudo systemctl status postgresql
sudo systemctl start postgresql

# On Windows
# Check services.msc for PostgreSQL service

# 2. Verify DATABASE_URL format
# Correct format:
DATABASE_URL="postgresql://username:password@localhost:5432/database_name?schema=public"

# 3. Test database connection manually
psql -h localhost -p 5432 -U username -d database_name
```

**Problem:** Database does not exist
```
Error: Database "your_database_name" does not exist
```

**Solutions:**
```bash
# Create the database
createdb your_database_name

# Or using SQL
psql -U postgres -c "CREATE DATABASE your_database_name;"

# Then run Prisma commands
npm run db:generate
npm run db:push
```

### Prisma Issues

**Problem:** Prisma Client not generated
```
Error: @prisma/client did not initialize yet.
```

**Solutions:**
```bash
# Generate Prisma client
npm run db:generate

# If that doesn't work, try:
npx prisma generate

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run db:generate
```

**Problem:** Schema out of sync
```
Error: The database schema is not in sync with your Prisma schema.
```

**Solutions:**
```bash
# For development (destructive)
npm run db:push

# For production (safe)
npm run db:migrate

# Reset database (development only)
npm run db:reset
```

**Problem:** Migration issues
```
Error: Migration failed to apply cleanly to the shadow database.
```

**Solutions:**
```bash
# Reset migration history (development only)
npx prisma migrate reset

# Create new migration
npx prisma migrate dev --name fix_schema

# For production, apply migrations manually
npx prisma migrate deploy
```

## 🔐 Authentication Issues

### JWT Token Problems

**Problem:** Token is invalid or expired
```
Error: Invalid token
Error: jwt expired
```

**Solutions:**
```bash
# 1. Check JWT_SECRET in .env
echo $JWT_SECRET
# Should be a long, random string

# 2. Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 3. Check token expiration settings
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=30
```

**Problem:** Authorization header format issues
```
Error: No auth token
Error: Bearer token malformed
```

**Solutions:**
```bash
# Correct format:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Test with curl:
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/v1/users/me
```

### Permission Errors

**Problem:** 403 Forbidden errors
```
Error: Forbidden
```

**Solutions:**
```typescript
// Check user roles and permissions
// In src/config/roles.ts
const roleRights = new Map([
  ['user', ['getProfile', 'updateProfile']],
  ['admin', ['getUsers', 'manageUsers', 'getProfile', 'updateProfile']],
]);

// Verify middleware usage in routes
router.get('/users', auth('getUsers'), userController.getUsers);
//                        ^^^^^^^^^^
//                        Check this permission exists in roles
```

## 🐛 TypeScript Issues

### Type Errors

**Problem:** TypeScript compilation errors
```
Error: Property 'user' does not exist on type 'Request'
```

**Solutions:**
```typescript
// Add type declarations in src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        role: 'USER' | 'ADMIN';
        email: string;
        name: string;
      };
    }
  }
}

export {};
```

**Problem:** Import path issues
```
Error: Cannot find module '@/config/database'
```

**Solutions:**
```json
// Check tsconfig.json paths configuration
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

```bash
# Install tsconfig-paths for development
npm install --save-dev tsconfig-paths

# Check if ts-node is configured properly in package.json
"ts-node": {
  "require": ["tsconfig-paths/register"]
}
```

### Build Issues

**Problem:** Build fails with TypeScript errors
```
Error: Type 'string | undefined' is not assignable to type 'string'
```

**Solutions:**
```bash
# Run type checking to see all errors
npm run typecheck

# Common fixes:
```

```typescript
// Use optional chaining and nullish coalescing
const userId = req.user?.id ?? '';

// Use type guards
if (!req.params.id) {
  throw new ApiError(400, 'ID is required');
}

// Use type assertions carefully
const config = process.env.NODE_ENV as 'development' | 'production' | 'test';
```

## 🧪 Testing Issues

### Test Database Issues

**Problem:** Tests failing due to database state
```
Error: UNIQUE constraint failed
Error: Foreign key constraint failed
```

**Solutions:**
```typescript
// Ensure proper test isolation
// In tests/utils/setupTestDB.ts
beforeEach(async () => {
  await clearDatabase();
});

const clearDatabase = async () => {
  // Clear in correct order (foreign keys first)
  await prisma.token.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
};
```

**Problem:** Test timeout issues
```
Error: Timeout - Async callback was not invoked within timeout
```

**Solutions:**
```typescript
// Increase timeout in jest.config.js
module.exports = {
  testTimeout: 30000, // 30 seconds
};

// Or in individual tests
describe('Slow tests', () => {
  jest.setTimeout(30000);
  
  test('slow operation', async () => {
    // test code
  });
});

// Ensure proper cleanup
afterAll(async () => {
  await prisma.$disconnect();
});
```

### Mock Issues

**Problem:** Mocks not working properly
```
Error: Module not found in manual mock
```

**Solutions:**
```typescript
// Create proper mock in __mocks__ directory
// __mocks__/email.service.ts
export default {
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test' }),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
};

// Use mock properly in tests
jest.mock('../../src/services/email.service');
```

## 🌐 Server Issues

### Port Issues

**Problem:** Port already in use
```
Error: listen EADDRINUSE :::3000
```

**Solutions:**
```bash
# Find what's using the port
lsof -i :3000
netstat -tulpn | grep :3000

# Kill the process
kill -9 PID

# Or change port in .env
PORT=3001

# Or use different port temporarily
PORT=3001 npm run dev
```

### Memory Issues

**Problem:** Out of memory errors
```
Error: JavaScript heap out of memory
```

**Solutions:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or in package.json scripts
"dev": "NODE_OPTIONS='--max-old-space-size=4096' nodemon src/index.ts"

# Check for memory leaks
npm install -g clinic
clinic doctor -- npm start
```

### SSL/HTTPS Issues

**Problem:** SSL certificate errors in development
```
Error: unable to verify the first certificate
```

**Solutions:**
```bash
# For development only (not recommended for production)
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Better: Use proper certificates
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

## 📦 Dependencies Issues

### Node Modules Issues

**Problem:** Module not found errors
```
Error: Cannot find module 'some-package'
```

**Solutions:**
```bash
# Clear and reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for version conflicts
npm ls

# Update dependencies
npm update

# Check for security vulnerabilities
npm audit
npm audit fix
```

### Version Compatibility Issues

**Problem:** Peer dependency warnings
```
Warning: peer dep missing
```

**Solutions:**
```bash
# Install peer dependencies
npm install --save-dev @types/node @types/express

# Check compatibility
npm ls --depth=0

# Use specific versions if needed
npm install package@specific-version
```

## 🐳 Docker Issues

### Container Build Issues

**Problem:** Docker build fails
```
Error: failed to solve: process "/bin/sh -c npm install" did not complete
```

**Solutions:**
```dockerfile
# Use specific Node version
FROM node:18-alpine

# Clear npm cache
RUN npm cache clean --force

# Use npm ci instead of npm install
RUN npm ci --only=production

# Check .dockerignore
# .dockerignore should include:
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.vscode
```

### Container Runtime Issues

**Problem:** Container exits immediately
```
Container exits with code 0
```

**Solutions:**
```bash
# Check container logs
docker logs container-name

# Run container interactively
docker run -it image-name /bin/sh

# Check if main process is running
docker exec -it container-name ps aux
```

**Problem:** Database connection issues in Docker
```
Error: getaddrinfo ENOTFOUND postgres
```

**Solutions:**
```yaml
# In docker-compose.yml, ensure proper networking
services:
  api:
    depends_on:
      - postgres
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/db
  
  postgres:
    image: postgres:15-alpine
```

## 🚀 Deployment Issues

### Environment Variables

**Problem:** Environment variables not loaded
```
Error: JWT_SECRET is required
```

**Solutions:**
```bash
# Check if .env file exists
ls -la .env*

# Verify environment loading
node -e "require('dotenv').config(); console.log(process.env.JWT_SECRET)"

# For production deployment
export JWT_SECRET="your-production-secret"

# Check if process.env is accessed correctly
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
```

### Build Issues in Production

**Problem:** TypeScript files not found in production
```
Error: Cannot find module './src/index.ts'
```

**Solutions:**
```json
// Ensure build script in package.json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/src/index.js"
  }
}
```

```bash
# Build before deploying
npm run build

# Check dist folder is created
ls -la dist/
```

## 🔍 Debugging Techniques

### Enable Debug Logging

```typescript
// src/config/logger.ts
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  // ... other config
});

// Use in code
logger.debug('Debug information:', { data: someData });
logger.error('Error occurred:', error);
```

### Database Query Debugging

```typescript
// Enable Prisma query logging
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Or set environment variable
DEBUG="prisma:query" npm run dev
```

### Request Debugging

```bash
# Enable detailed request logging
DEBUG="express:*" npm run dev

# Test API endpoints with verbose curl
curl -v -H "Content-Type: application/json" -d '{"email":"test@test.com"}' http://localhost:3000/v1/auth/login
```

### Memory and Performance Debugging

```bash
# Install debugging tools
npm install --save-dev clinic

# Debug performance
clinic doctor -- npm start

# Debug memory usage
clinic heapdump -- npm start

# Monitor in real-time
clinic bubbleprof -- npm start
```

## 📋 Health Checks

### Application Health Check

```bash
# Basic health check
curl http://localhost:3000/v1/health

# Expected response:
{
  "status": "OK",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "uptime": 120.5,
  "memory": {...},
  "database": "connected"
}
```

### Database Health Check

```bash
# Check database connection
npx prisma db push --preview-feature

# Test query
psql -h localhost -U postgres -d your_db -c "SELECT version();"
```

### Dependencies Health Check

```bash
# Check for outdated packages
npm outdated

# Security audit
npm audit

# License check
npm install -g license-checker
license-checker
```

## 🆘 Getting Help

When troubleshooting:

1. **Check logs**: Always start with application and database logs
2. **Isolate the issue**: Try to reproduce with minimal code
3. **Check environment**: Verify all environment variables
4. **Test components**: Test database, auth, and API separately
5. **Use debugging tools**: Enable verbose logging and debugging
6. **Search issues**: Check GitHub issues for similar problems
7. **Create minimal reproduction**: If reporting bugs, create minimal example

### Useful Commands for Debugging

```bash
# Check all environment variables
printenv | grep -E "(NODE_ENV|DATABASE_URL|JWT_SECRET|PORT)"

# Test database connectivity
pg_isready -h localhost -p 5432

# Check if port is available
netstat -tulpn | grep :3000

# Monitor logs in real-time
tail -f logs/combined.log

# Check system resources
top
df -h
free -m
```

### Common Log Locations

```bash
# Application logs
./logs/combined.log
./logs/error.log

# PM2 logs
~/.pm2/logs/

# Docker logs
docker logs container-name

# System logs (Linux)
/var/log/nginx/error.log
/var/log/postgresql/postgresql.log
```

Remember: When in doubt, check the logs first! Most issues can be diagnosed by carefully reading error messages and stack traces.

---

**Next: Explore advanced usage patterns in the [Advanced Patterns Guide](ADVANCED-PATTERNS.md)**