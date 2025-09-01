# Advanced Patterns Guide

Advanced usage patterns, customizations, and architectural improvements for your TypeScript REST API.

## 🎯 Advanced Middleware Patterns

### Custom Middleware Development

**Rate Limiting Middleware:**
```typescript
// src/middlewares/customRateLimit.ts
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Different limits for different endpoint types
export const createCustomRateLimit = (options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rate_limit:',
    }),
    windowMs: options.windowMs,
    max: options.max,
    keyGenerator: options.keyGenerator || ((req) => req.ip),
    message: {
      error: 'Too many requests, please try again later.',
      resetTime: new Date(Date.now() + options.windowMs),
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Usage in routes
export const authRateLimit = createCustomRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  keyGenerator: (req) => `${req.ip}:${req.body?.email || 'unknown'}`,
});

export const apiRateLimit = createCustomRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
});
```

**Request ID Middleware:**
```typescript
// src/middlewares/requestId.ts
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  req.id = req.headers['x-request-id'] as string || randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
};

// Usage in logger
logger.info('Request started', {
  requestId: req.id,
  method: req.method,
  url: req.url,
});
```

**Advanced Authentication Middleware:**
```typescript
// src/middlewares/advancedAuth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';

const prisma = new PrismaClient();

interface AuthOptions {
  required?: boolean;
  roles?: string[];
  permissions?: string[];
  resourceOwnership?: {
    paramName: string;
    resourceType: string;
  };
}

export const advancedAuth = (options: AuthOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token && options.required !== false) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Access token required');
      }

      if (token) {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isEmailVerified: true,
          },
        });

        if (!user) {
          throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token');
        }

        req.user = user;

        // Role-based access control
        if (options.roles && !options.roles.includes(user.role)) {
          throw new ApiError(httpStatus.FORBIDDEN, 'Insufficient role');
        }

        // Permission-based access control
        if (options.permissions && !hasPermissions(user.role, options.permissions)) {
          throw new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions');
        }

        // Resource ownership check
        if (options.resourceOwnership) {
          const resourceId = req.params[options.resourceOwnership.paramName];
          if (!(await isResourceOwner(user.id, resourceId, options.resourceOwnership.resourceType))) {
            throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Usage examples
router.get('/users/:userId', 
  advancedAuth({ 
    required: true, 
    resourceOwnership: { paramName: 'userId', resourceType: 'user' } 
  }), 
  userController.getUser
);
```

### Conditional Middleware

```typescript
// src/middlewares/conditional.ts
import { Request, Response, NextFunction } from 'express';

export const conditionalMiddleware = (
  condition: (req: Request) => boolean,
  middleware: (req: Request, res: Response, next: NextFunction) => void
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (condition(req)) {
      return middleware(req, res, next);
    }
    next();
  };
};

// Usage
router.use(
  conditionalMiddleware(
    (req) => req.url.startsWith('/api/'),
    rateLimitMiddleware
  )
);
```

## 📁 File Upload Patterns

### Advanced File Upload with Validation

```typescript
// src/middlewares/fileUpload.ts
import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';

// Custom storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads', req.user.id);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for validation
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new ApiError(httpStatus.BAD_REQUEST, 'Invalid file type'));
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5, // Maximum 5 files
  },
});

// File upload service
export class FileUploadService {
  static async uploadUserAvatar(userId: string, file: Express.Multer.File) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    
    if (!allowedTypes.includes(file.mimetype)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid file type for avatar');
    }

    // Process image (resize, optimize, etc.)
    const processedFile = await this.processImage(file);
    
    // Save file info to database
    const fileRecord = await prisma.file.create({
      data: {
        originalName: file.originalname,
        filename: processedFile.filename,
        mimetype: file.mimetype,
        size: file.size,
        userId,
        type: 'AVATAR',
      },
    });

    return fileRecord;
  }

  private static async processImage(file: Express.Multer.File) {
    // Use sharp for image processing
    const sharp = require('sharp');
    const processedBuffer = await sharp(file.buffer)
      .resize(400, 400)
      .jpeg({ quality: 80 })
      .toBuffer();

    // Save processed file
    // Return processed file info
    return { filename: file.filename, buffer: processedBuffer };
  }
}
```

### File Upload Routes

```typescript
// src/routes/v1/upload.route.ts
import express from 'express';
import { upload, FileUploadService } from '../../middlewares/fileUpload';
import auth from '../../middlewares/auth';
import catchAsync from '../../utils/catchAsync';

const router = express.Router();

// Single file upload
router.post('/avatar',
  auth(),
  upload.single('avatar'),
  catchAsync(async (req, res) => {
    if (!req.file) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
    }

    const fileRecord = await FileUploadService.uploadUserAvatar(req.user.id, req.file);
    res.status(httpStatus.OK).json(fileRecord);
  })
);

// Multiple files upload
router.post('/documents',
  auth(),
  upload.array('documents', 5),
  catchAsync(async (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No files uploaded');
    }

    const uploadedFiles = await Promise.all(
      files.map(file => FileUploadService.uploadDocument(req.user.id, file))
    );

    res.status(httpStatus.OK).json({ files: uploadedFiles });
  })
);

export default router;
```

## 🔄 Background Jobs and Queues

### Bull Queue Implementation

```typescript
// src/queues/emailQueue.ts
import Bull from 'bull';
import { emailService } from '../services';
import logger from '../config/logger';

const emailQueue = new Bull('email queue', process.env.REDIS_URL);

// Job processors
emailQueue.process('send-verification-email', async (job) => {
  const { email, token } = job.data;
  logger.info(`Processing verification email for ${email}`);
  
  try {
    await emailService.sendVerificationEmail(email, token);
    logger.info(`Verification email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send verification email to ${email}:`, error);
    throw error;
  }
});

emailQueue.process('send-password-reset', async (job) => {
  const { email, token } = job.data;
  logger.info(`Processing password reset email for ${email}`);
  
  try {
    await emailService.sendPasswordResetEmail(email, token);
    logger.info(`Password reset email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send password reset email to ${email}:`, error);
    throw error;
  }
});

// Job event handlers
emailQueue.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

emailQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err);
});

export class EmailQueue {
  static async sendVerificationEmail(email: string, token: string) {
    await emailQueue.add('send-verification-email', { email, token }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  static async sendPasswordResetEmail(email: string, token: string) {
    await emailQueue.add('send-password-reset', { email, token }, {
      attempts: 3,
      delay: 5000, // 5 second delay
    });
  }
}

export default emailQueue;
```

### Scheduled Jobs with Cron

```typescript
// src/jobs/scheduler.ts
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

export class JobScheduler {
  static start() {
    // Clean expired tokens daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      logger.info('Starting cleanup job for expired tokens');
      
      try {
        const result = await prisma.token.deleteMany({
          where: {
            expires: {
              lt: new Date(),
            },
          },
        });
        
        logger.info(`Cleaned up ${result.count} expired tokens`);
      } catch (error) {
        logger.error('Error during token cleanup:', error);
      }
    });

    // Send weekly digest emails
    cron.schedule('0 9 * * MON', async () => {
      logger.info('Starting weekly digest job');
      
      try {
        const users = await prisma.user.findMany({
          where: {
            emailDigestEnabled: true,
          },
        });

        for (const user of users) {
          await EmailQueue.sendWeeklyDigest(user.email, user.id);
        }
        
        logger.info(`Queued weekly digest for ${users.length} users`);
      } catch (error) {
        logger.error('Error during weekly digest job:', error);
      }
    });

    // Health check cleanup every hour
    cron.schedule('0 * * * *', async () => {
      try {
        // Clean up old health check logs, temporary files, etc.
        await this.cleanupTempFiles();
        await this.cleanupOldLogs();
      } catch (error) {
        logger.error('Error during hourly cleanup:', error);
      }
    });

    logger.info('Job scheduler started successfully');
  }

  private static async cleanupTempFiles() {
    // Implementation for cleaning temporary files
  }

  private static async cleanupOldLogs() {
    // Implementation for cleaning old log files
  }
}
```

## 🔍 Advanced Search Patterns

### Full-Text Search with PostgreSQL

```typescript
// src/services/search.service.ts
import { PrismaClient, Prisma } from '@prisma/client';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';

const prisma = new PrismaClient();

export class SearchService {
  static async searchProducts(query: string, filters?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  }) {
    // Use PostgreSQL full-text search
    const searchConditions: Prisma.ProductWhereInput = {
      OR: [
        {
          name: {
            search: query,
          },
        },
        {
          description: {
            search: query,
          },
        },
        {
          AND: query.split(' ').map(term => ({
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } },
              { category: { contains: term, mode: 'insensitive' } },
            ],
          })),
        },
      ],
    };

    if (filters) {
      if (filters.category) {
        searchConditions.category = {
          contains: filters.category,
          mode: 'insensitive',
        };
      }

      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        searchConditions.price = {};
        if (filters.minPrice !== undefined) {
          searchConditions.price.gte = filters.minPrice;
        }
        if (filters.maxPrice !== undefined) {
          searchConditions.price.lte = filters.maxPrice;
        }
      }

      if (filters.inStock !== undefined) {
        searchConditions.inStock = filters.inStock;
      }
    }

    const products = await prisma.product.findMany({
      where: searchConditions,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { _relevance: { fields: ['name', 'description'], search: query, sort: 'desc' } },
        { createdAt: 'desc' },
      ],
    });

    return products;
  }

  static async searchUsers(query: string, currentUserId: string) {
    // Search users (admin only or for mentions/friend requests)
    const searchConditions: Prisma.UserWhereInput = {
      AND: [
        {
          NOT: {
            id: currentUserId,
          },
        },
        {
          OR: [
            {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: query,
                mode: 'insensitive',
              },
            },
          ],
        },
      ],
    };

    const users = await prisma.user.findMany({
      where: searchConditions,
      select: {
        id: true,
        name: true,
        email: true,
        // Don't include sensitive data
      },
      take: 10, // Limit results
    });

    return users;
  }
}
```

### Advanced Filtering and Aggregation

```typescript
// src/services/analytics.service.ts
export class AnalyticsService {
  static async getProductAnalytics(userId?: string) {
    const whereCondition = userId ? { userId } : {};

    const analytics = await prisma.product.aggregate({
      where: whereCondition,
      _count: {
        _all: true,
      },
      _avg: {
        price: true,
      },
      _max: {
        price: true,
      },
      _min: {
        price: true,
      },
    });

    // Category breakdown
    const categoryStats = await prisma.product.groupBy({
      by: ['category'],
      where: whereCondition,
      _count: {
        _all: true,
      },
      _avg: {
        price: true,
      },
    });

    // Monthly sales data
    const monthlySales = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "createdAt") as month,
        COUNT(*) as count,
        AVG(price) as average_price
      FROM products
      ${userId ? Prisma.sql`WHERE "userId" = ${userId}` : Prisma.empty}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month DESC
      LIMIT 12
    `;

    return {
      summary: analytics,
      categories: categoryStats,
      monthlyTrends: monthlySales,
    };
  }
}
```

## 🔐 Advanced Security Patterns

### API Key Authentication

```typescript
// src/middlewares/apiKeyAuth.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';

const prisma = new PrismaClient();

export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'API key required');
    }

    // Hash the provided API key
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Find the API key in database
    const keyRecord = await prisma.apiKey.findUnique({
      where: { hashedKey },
      include: { user: true },
    });

    if (!keyRecord || !keyRecord.isActive) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid API key');
    }

    // Check rate limits for API key
    await checkApiKeyRateLimit(keyRecord.id);

    // Add user to request
    req.user = keyRecord.user;
    req.apiKey = keyRecord;

    // Log API key usage
    await prisma.apiKeyUsage.create({
      data: {
        apiKeyId: keyRecord.id,
        endpoint: req.path,
        method: req.method,
        ipAddress: req.ip,
      },
    });

    next();
  } catch (error) {
    next(error);
  }
};
```

### Request Signing

```typescript
// src/middlewares/requestSigning.ts
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';

export const verifySignature = (secret: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;

    if (!signature || !timestamp) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Missing signature or timestamp');
    }

    // Check if request is not too old (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);

    if (Math.abs(now - requestTime) > 300) { // 5 minutes
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Request timestamp too old');
    }

    // Create expected signature
    const payload = `${timestamp}.${JSON.stringify(req.body)}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');
    const actualSignatureBuffer = Buffer.from(signature, 'hex');

    // Verify signature using constant-time comparison
    if (!crypto.timingSafeEqual(expectedSignatureBuffer, actualSignatureBuffer)) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid signature');
    }

    next();
  };
};
```

## 🎨 Response Transformation Patterns

### API Response Standardization

```typescript
// src/utils/responseTransformer.ts
import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    version: string;
  };
}

export class ResponseTransformer {
  static success<T>(
    res: Response,
    data: T,
    statusCode: number = 200,
    pagination?: ApiResponse['pagination']
  ) {
    const response: ApiResponse<T> = {
      success: true,
      data,
      ...(pagination && { pagination }),
      meta: {
        timestamp: new Date().toISOString(),
        requestId: res.get('x-request-id'),
        version: process.env.API_VERSION || '1.0.0',
      },
    };

    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    code: string,
    message: string,
    statusCode: number = 400,
    details?: any
  ) {
    const response: ApiResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: res.get('x-request-id'),
        version: process.env.API_VERSION || '1.0.0',
      },
    };

    return res.status(statusCode).json(response);
  }
}

// Usage in controllers
export const getProducts = catchAsync(async (req: Request, res: Response) => {
  const result = await productService.queryProducts(filter, options);
  
  return ResponseTransformer.success(res, result.results, 200, {
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
    totalItems: result.totalResults,
  });
});
```

### Data Serialization

```typescript
// src/serializers/userSerializer.ts
export class UserSerializer {
  static serialize(user: any, currentUser?: any) {
    const serialized = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      avatar: user.avatar ? this.serializeFile(user.avatar) : null,
    };

    // Add sensitive information only for the user themselves or admins
    if (currentUser && (currentUser.id === user.id || currentUser.role === 'ADMIN')) {
      return {
        ...serialized,
        lastLoginAt: user.lastLoginAt,
        preferences: user.preferences,
      };
    }

    return serialized;
  }

  static serializeMany(users: any[], currentUser?: any) {
    return users.map(user => this.serialize(user, currentUser));
  }

  private static serializeFile(file: any) {
    return {
      id: file.id,
      url: `/uploads/${file.filename}`,
      type: file.mimetype,
      size: file.size,
    };
  }
}
```

## 📊 Caching Patterns

### Redis Caching Implementation

```typescript
// src/cache/redisCache.ts
import Redis from 'ioredis';
import logger from '../config/logger';

class RedisCache {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('connect', () => {
      logger.info('Connected to Redis');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error(`Cache SET error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache DEL error for key ${key}:`, error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<boolean> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      logger.error(`Cache invalidation error for pattern ${pattern}:`, error);
      return false;
    }
  }
}

export const cache = new RedisCache();
```

### Service Layer Caching

```typescript
// src/services/cachedProduct.service.ts
import { cache } from '../cache/redisCache';
import productService from './product.service';

export class CachedProductService {
  static async getProductById(id: string) {
    const cacheKey = `product:${id}`;
    
    // Try cache first
    let product = await cache.get(cacheKey);
    
    if (!product) {
      // Fetch from database
      product = await productService.getProductById(id);
      
      if (product) {
        // Cache for 1 hour
        await cache.set(cacheKey, product, 3600);
      }
    }
    
    return product;
  }

  static async updateProductById(id: string, updateData: any) {
    const product = await productService.updateProductById(id, updateData);
    
    // Invalidate cache
    await cache.del(`product:${id}`);
    await cache.invalidatePattern(`products:*`);
    
    return product;
  }

  static async queryProducts(filter: any, options: any) {
    const cacheKey = `products:${JSON.stringify({ filter, options })}`;
    
    let result = await cache.get(cacheKey);
    
    if (!result) {
      result = await productService.queryProducts(filter, options);
      // Cache for 15 minutes
      await cache.set(cacheKey, result, 900);
    }
    
    return result;
  }
}
```

## 🔄 Event-Driven Architecture

### Event System Implementation

```typescript
// src/events/eventEmitter.ts
import { EventEmitter } from 'events';
import logger from '../config/logger';

class AppEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Increase limit for high-traffic apps
    
    // Log all events in development
    if (process.env.NODE_ENV === 'development') {
      this.on('newListener', (event, listener) => {
        logger.debug(`New listener added for event: ${event}`);
      });
    }
  }

  emitAsync(event: string, ...args: any[]) {
    return new Promise((resolve, reject) => {
      try {
        this.emit(event, ...args);
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const eventEmitter = new AppEventEmitter();

// Event types
export enum AppEvents {
  USER_REGISTERED = 'user:registered',
  USER_LOGGED_IN = 'user:logged_in',
  USER_UPDATED = 'user:updated',
  PRODUCT_CREATED = 'product:created',
  PRODUCT_UPDATED = 'product:updated',
  ORDER_PLACED = 'order:placed',
}
```

### Event Handlers

```typescript
// src/events/userEventHandlers.ts
import { eventEmitter, AppEvents } from './eventEmitter';
import { EmailQueue } from '../queues/emailQueue';
import { AnalyticsService } from '../services/analytics.service';
import logger from '../config/logger';

// User registration event handler
eventEmitter.on(AppEvents.USER_REGISTERED, async (userData) => {
  try {
    logger.info(`User registered: ${userData.email}`);
    
    // Send welcome email
    await EmailQueue.sendWelcomeEmail(userData.email, userData.name);
    
    // Track analytics
    await AnalyticsService.trackUserRegistration(userData);
    
    // Create user preferences
    await UserPreferencesService.createDefaultPreferences(userData.id);
    
  } catch (error) {
    logger.error('Error handling user registration event:', error);
  }
});

// Product creation event handler
eventEmitter.on(AppEvents.PRODUCT_CREATED, async (productData) => {
  try {
    logger.info(`Product created: ${productData.name} by user ${productData.userId}`);
    
    // Invalidate cache
    await cache.invalidatePattern('products:*');
    
    // Update search index
    await SearchService.indexProduct(productData);
    
    // Notify followers (if applicable)
    await NotificationService.notifyFollowers(productData.userId, 'new_product', productData);
    
  } catch (error) {
    logger.error('Error handling product creation event:', error);
  }
});
```

### Usage in Services

```typescript
// src/services/user.service.ts (updated with events)
import { eventEmitter, AppEvents } from '../events/eventEmitter';

const createUser = async (userBody: CreateUserData): Promise<User> => {
  // ... existing user creation logic
  
  const user = await prisma.user.create({
    data: hashedUserData,
  });

  // Emit event
  eventEmitter.emit(AppEvents.USER_REGISTERED, user);
  
  return user;
};
```

## 📈 Performance Optimization Patterns

### Database Query Optimization

```typescript
// src/services/optimizedQuery.service.ts
export class OptimizedQueryService {
  // Use dataloader for N+1 query prevention
  private static createUserLoader() {
    return new DataLoader(async (userIds: string[]) => {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      });
      
      return userIds.map(id => users.find(user => user.id === id));
    });
  }

  // Efficient pagination with cursor-based approach
  static async getPaginatedProducts(cursor?: string, take: number = 10) {
    const products = await prisma.product.findMany({
      take: take + 1, // Take one extra to check if there are more
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    const hasNextPage = products.length > take;
    const items = hasNextPage ? products.slice(0, -1) : products;

    return {
      items,
      nextCursor: hasNextPage ? items[items.length - 1].id : null,
      hasNextPage,
    };
  }

  // Bulk operations
  static async bulkCreateProducts(productsData: CreateProductData[]) {
    return prisma.$transaction(
      productsData.map(data => 
        prisma.product.create({ data })
      )
    );
  }
}
```

### Connection Pooling

```typescript
// src/config/database.ts (optimized)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Connection pooling configuration
if (process.env.NODE_ENV === 'production') {
  // Optimize for production
  prisma.$connect();
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
```

This advanced patterns guide provides sophisticated techniques for building scalable, maintainable TypeScript REST APIs. Each pattern addresses specific challenges you might encounter as your application grows in complexity and scale.

---

**Congratulations! 🎉 You now have a comprehensive understanding of the TypeScript REST API starter and advanced patterns for building production-ready applications.**