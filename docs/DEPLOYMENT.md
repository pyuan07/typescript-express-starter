# Deployment Guide

Complete guide for deploying your TypeScript REST API to production using Docker, PM2, and various cloud platforms.

## 🚀 Deployment Options

1. **[Docker Deployment](#docker-deployment)** - Containerized deployment (recommended)
2. **[PM2 Deployment](#pm2-deployment)** - Process management on VPS/bare metal
3. **[Cloud Platform Deployment](#cloud-platform-deployment)** - Heroku, Railway, Render, etc.
4. **[Kubernetes Deployment](#kubernetes-deployment)** - For enterprise/scalable deployments

## 🐳 Docker Deployment

### Development with Docker

**Start Development Environment:**
```bash
# Start all services (API + PostgreSQL)
docker-compose up

# Start only PostgreSQL (for local development)
docker-compose up postgres -d

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

**Docker Compose Configuration:**
```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: development
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/typescript_starter_db?schema=public
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules
    depends_on:
      - postgres
    command: npm run dev

  postgres:
    image: postgres:15-alpine
    ports:
      - '5432:5432'
    environment:
      POSTGRES_DB: typescript_starter_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Production Docker Setup

**Multi-stage Dockerfile:**
```dockerfile
# Dockerfile
FROM node:18-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./

# Dependencies stage
FROM base AS dependencies
RUN npm ci --only=production
COPY . .

# Development stage
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

# Production stage
FROM node:18-alpine AS production
WORKDIR /usr/src/app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application
COPY --from=build --chown=nodejs:nodejs /usr/src/app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /usr/src/app/package*.json ./
COPY --from=build --chown=nodejs:nodejs /usr/src/app/prisma ./prisma

USER nodejs
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/src/healthcheck.js || exit 1

CMD ["npm", "start"]
```

**Production Docker Compose:**
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    build:
      context: .
      target: production
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - PORT=3000
    depends_on:
      - postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/v1/health"]
      timeout: 5s
      interval: 30s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backup:/backup
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
```

**Production Deployment:**
```bash
# Build and start production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# View logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Update application
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

## 📊 PM2 Deployment

PM2 is excellent for VPS deployments and provides process management, monitoring, and clustering.

### PM2 Setup

**Install PM2 Globally:**
```bash
npm install -g pm2
```

**PM2 Configuration:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'typescript-api',
    script: 'dist/src/index.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: process.env.DATABASE_URL,
      JWT_SECRET: process.env.JWT_SECRET,
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=1024'
  }],

  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/your-username/your-repo.git',
      path: '/var/www/your-app',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --production && npm run build && pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': ''
    }
  }
};
```

**PM2 Commands:**
```bash
# Build the project
npm run build

# Start application with PM2
pm2 start ecosystem.config.js --env production

# Alternative: start directly
npm run start:pm2

# Monitor applications
pm2 status
pm2 logs typescript-api
pm2 monit

# Restart application
pm2 restart typescript-api

# Reload application (zero downtime)
pm2 reload typescript-api

# Stop application
pm2 stop typescript-api

# Delete application from PM2
pm2 delete typescript-api

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### PM2 Deployment Script

```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 Starting deployment..."

# Pull latest changes
git pull origin main

echo "📦 Installing dependencies..."
npm ci --production

echo "🏗️  Building application..."
npm run build

echo "🗄️  Running database migrations..."
npx prisma migrate deploy

echo "🔄 Reloading PM2 application..."
pm2 reload ecosystem.config.js --env production

echo "💾 Saving PM2 configuration..."
pm2 save

echo "✅ Deployment completed successfully!"

# Check application health
sleep 5
curl -f http://localhost:3000/v1/health || {
  echo "❌ Health check failed!"
  exit 1
}

echo "🎉 Application is healthy and running!"
```

## ☁️ Cloud Platform Deployment

### Heroku Deployment

**Heroku Setup:**
```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login to Heroku
heroku login

# Create Heroku app
heroku create your-app-name

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET="your-production-jwt-secret"

# Deploy
git push heroku main

# Run database migrations
heroku run npx prisma migrate deploy

# View logs
heroku logs --tail
```

**Procfile:**
```
web: npm start
release: npx prisma migrate deploy
```

**Heroku package.json scripts:**
```json
{
  "scripts": {
    "start": "node dist/src/index.js",
    "heroku-postbuild": "npm run build"
  }
}
```

### Railway Deployment

**Railway Setup:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add --database postgresql

# Set environment variables
railway variables set NODE_ENV=production
railway variables set JWT_SECRET="your-production-jwt-secret"

# Deploy
railway up
```

### Render Deployment

**render.yaml:**
```yaml
services:
  - type: web
    name: typescript-api
    env: node
    plan: starter
    buildCommand: npm ci && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: postgres-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true

databases:
  - name: postgres-db
    plan: starter
```

## ⚙️ Environment-Specific Configuration

### Production Environment Variables

```bash
# Production .env
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL="postgresql://user:password@host:5432/production_db?schema=public"

# JWT (Use strong, random secrets!)
JWT_SECRET="your-super-secure-64-character-random-string-for-production-use-only"
JWT_ACCESS_EXPIRATION_MINUTES=15
JWT_REFRESH_EXPIRATION_DAYS=7

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-production-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourapp.com

# Security
CORS_ORIGIN=https://your-frontend-domain.com
```

### Staging Environment

```bash
# Staging .env
NODE_ENV=staging
DATABASE_URL="postgresql://user:password@staging-host:5432/staging_db?schema=public"
JWT_SECRET="staging-jwt-secret-different-from-production"
```

## 🔒 Security Considerations

### Production Security Checklist

- [ ] **Strong JWT Secret**: Use 64+ character random string
- [ ] **HTTPS Enabled**: Configure SSL certificates
- [ ] **Environment Variables Secured**: Never commit secrets to git
- [ ] **Database Secured**: Restrict access, use connection pooling
- [ ] **Firewall Configured**: Only open necessary ports
- [ ] **Rate Limiting Enabled**: Protect against abuse
- [ ] **Input Validation**: All user inputs validated
- [ ] **Error Handling**: Don't expose sensitive information in errors
- [ ] **Logging Configured**: Monitor application behavior
- [ ] **Backup Strategy**: Regular database backups
- [ ] **Health Checks**: Monitor application status
- [ ] **Security Headers**: Helmet configured properly

### Nginx Reverse Proxy

```nginx
# nginx.conf
upstream api {
    server api:3000;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-cert.crt;
    ssl_certificate_key /etc/ssl/certs/your-cert.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # API routes
    location / {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        access_log off;
        proxy_pass http://api/v1/health;
    }
}
```

## 📊 Monitoring and Logging

### Health Check Endpoint

```typescript
// src/routes/v1/health.route.ts
import express from 'express';
import httpStatus from 'http-status';
import prisma from '../../config/database';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(httpStatus.OK).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'typescript-api',
      version: process.env.npm_package_version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (error) {
    res.status(httpStatus.SERVICE_UNAVAILABLE).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

export default router;
```

### Application Monitoring

**PM2 Monitoring:**
```bash
# Install PM2 monitoring
pm2 install pm2-server-monit

# View real-time monitoring
pm2 monit

# Generate monitoring reports
pm2 web
```

**Docker Health Checks:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/v1/health || exit 1
```

### Log Management

**Production Logging Configuration:**
```typescript
// src/config/logger.ts (production settings)
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});
```

## 🔧 Database Management

### Production Database Setup

```bash
# Create production database
createdb production_app_db

# Run migrations
DATABASE_URL="postgresql://user:pass@host:5432/production_app_db" npx prisma migrate deploy

# Seed production data (if needed)
DATABASE_URL="postgresql://user:pass@host:5432/production_app_db" npm run db:seed
```

### Backup Strategy

```bash
#!/bin/bash
# backup-db.sh

DB_NAME="production_app_db"
BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
pg_dump -h localhost -U postgres $DB_NAME | gzip > "$BACKUP_DIR/backup_${DATE}.sql.gz"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_${DATE}.sql.gz"
```

**Schedule with cron:**
```bash
# Add to crontab
0 2 * * * /path/to/backup-db.sh
```

## 🚨 Troubleshooting

### Common Deployment Issues

**Docker Issues:**
```bash
# Check container logs
docker logs container-name

# Access container shell
docker exec -it container-name /bin/sh

# Rebuild without cache
docker-compose build --no-cache

# Check resource usage
docker stats
```

**PM2 Issues:**
```bash
# Clear PM2 logs
pm2 flush

# Restart all PM2 processes
pm2 restart all

# Check PM2 process details
pm2 describe app-name

# PM2 process not starting
pm2 logs app-name --lines 50
```

**Database Connection Issues:**
```bash
# Test database connection
psql -h host -U user -d database

# Check Prisma connection
npx prisma db push --preview-feature

# View database logs
docker logs postgres-container
```

**SSL Certificate Issues:**
```bash
# Test SSL configuration
openssl s_client -connect your-domain.com:443

# Renew Let's Encrypt certificate
certbot renew

# Check certificate expiration
openssl x509 -in certificate.crt -text -noout | grep "Not After"
```

### Performance Optimization

**Node.js Optimization:**
```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=2048" npm start

# Enable cluster mode with PM2
pm2 start ecosystem.config.js -i max
```

**Database Optimization:**
```sql
-- Add database indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_user_id ON products(user_id);

-- Analyze database performance
EXPLAIN ANALYZE SELECT * FROM products WHERE category = 'Electronics';
```

## ✅ Deployment Checklist

Before going to production:

**Pre-deployment:**
- [ ] All tests passing
- [ ] Code review completed
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] SSL certificates obtained
- [ ] Monitoring setup configured
- [ ] Backup strategy implemented
- [ ] Security review completed

**Deployment:**
- [ ] Database backup created
- [ ] Application deployed
- [ ] Database migrations applied
- [ ] Health checks passing
- [ ] SSL configuration verified
- [ ] Performance testing completed
- [ ] Monitoring alerts configured

**Post-deployment:**
- [ ] Application functionality verified
- [ ] Performance metrics checked
- [ ] Log monitoring setup
- [ ] Error tracking configured
- [ ] Team notifications setup
- [ ] Rollback plan documented

---

**Next: Learn advanced patterns in the [Advanced Patterns Guide](ADVANCED-PATTERNS.md)**