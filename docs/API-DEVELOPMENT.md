# API Development Guide

Learn how to create robust, secure, and well-tested APIs using this TypeScript starter.

## 🎯 Development Workflow

The typical workflow for adding new API functionality:

1. **Plan** → Define your data model and endpoints
2. **Database** → Update Prisma schema
3. **Service** → Implement business logic
4. **Controller** → Handle HTTP requests/responses
5. **Validation** → Create Zod schemas
6. **Routes** → Define API endpoints with middleware
7. **Test** → Write comprehensive tests
8. **Document** → Add Swagger documentation

## 🗄️ Database-First Development

### Updating Prisma Schema

```prisma
// prisma/schema.prisma
model Product {
  id          String   @id @default(cuid())
  name        String   @unique
  price       Float
  description String?
  category    String
  inStock     Boolean  @default(true)
  userId      String   // Owner of the product
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("products")
}

// Don't forget to update User model for relationships
model User {
  // ... existing fields
  products    Product[] // Add this line
  
  @@map("users")
}
```

**Apply Database Changes:**
```bash
# Generate Prisma client with new model
npm run db:generate

# Apply schema changes to database (development)
npm run db:push

# Or create a migration for production
npx prisma migrate dev --name add_product_model

# Verify changes in Prisma Studio
npm run db:studio
```

## 🏗️ Service Layer Development

Services contain your business logic and database operations.

### Service Patterns

```typescript
// src/services/product.service.ts
import { Product, Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import prisma from '../config/database';
import ApiError from '../utils/ApiError';
import { validatePagination, validateSort, isValidUuid } from '../utils/validation';

interface CreateProductData {
  name: string;
  price: number;
  description?: string;
  category: string;
  inStock?: boolean;
  userId: string;
}

interface QueryOptions {
  sortBy?: string;
  limit?: string | number;
  page?: string | number;
}

interface QueryResult<T> {
  results: T[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}
```

### CRUD Operations

**Create Operation:**
```typescript
const createProduct = async (productBody: CreateProductData): Promise<Product> => {
  // 1. Validate UUID format
  if (!isValidUuid(productBody.userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID format');
  }

  // 2. Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: productBody.userId },
  });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // 3. Check for duplicates
  const existingProduct = await prisma.product.findFirst({
    where: { name: productBody.name },
  });
  if (existingProduct) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Product name already exists');
  }

  // 4. Create with relationship data
  const product = await prisma.product.create({
    data: {
      ...productBody,
      inStock: productBody.inStock ?? true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return product;
};
```

**Query with Pagination:**
```typescript
const queryProducts = async (filter: any, options: QueryOptions): Promise<QueryResult<Product>> => {
  // Validate and sanitize pagination
  const { page, limit } = validatePagination(options.page, options.limit);
  const skip = (page - 1) * limit;

  // Build where clause with input sanitization
  const where: Prisma.ProductWhereInput = {};
  
  if (filter.name && typeof filter.name === 'string') {
    const sanitizedName = filter.name.trim().slice(0, 100);
    if (sanitizedName.length > 0) {
      where.name = { contains: sanitizedName, mode: 'insensitive' };
    }
  }
  
  if (filter.category && typeof filter.category === 'string') {
    const sanitizedCategory = filter.category.trim().slice(0, 50);
    if (sanitizedCategory.length > 0) {
      where.category = { contains: sanitizedCategory, mode: 'insensitive' };
    }
  }
  
  if (filter.inStock !== undefined) {
    where.inStock = filter.inStock === 'true' || filter.inStock === true;
  }

  // Build orderBy clause with whitelist validation for security
  const allowedSortFields = ['name', 'price', 'category', 'createdAt', 'updatedAt'] as const;
  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };

  const sortValidation = validateSort(options.sortBy, allowedSortFields);
  if (sortValidation) {
    orderBy = { [sortValidation.field]: sortValidation.order } as Prisma.ProductOrderByWithRelationInput;
  }

  // Execute queries in parallel for performance
  const [totalResults, results] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalResults / limit);

  return {
    results,
    page,
    limit,
    totalPages,
    totalResults,
  };
};
```

**Security-First Read Operation:**
```typescript
const getProductById = async (id: string): Promise<Product | null> => {
  // Always validate UUID format
  if (!isValidUuid(id)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid product ID format');
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          // Never include sensitive fields like password
        },
      },
    },
  });

  return product;
};
```

**Update with Ownership Check:**
```typescript
const updateProductById = async (productId: string, updateBody: UpdateProductData): Promise<Product> => {
  if (!isValidUuid(productId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid product ID format');
  }

  const product = await getProductById(productId);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }

  // Check for name conflicts
  if (updateBody.name && updateBody.name !== product.name) {
    const existingProduct = await prisma.product.findFirst({
      where: { 
        name: updateBody.name,
        NOT: { id: productId },
      },
    });
    if (existingProduct) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Product name already exists');
    }
  }

  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: updateBody,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return updatedProduct;
};
```

## 🎮 Controller Development

Controllers handle HTTP-specific logic and delegate business logic to services.

### Controller Patterns

```typescript
// src/controllers/product.controller.ts
import httpStatus from 'http-status';
import { Request, Response } from 'express';
import ApiError from '../utils/ApiError';
import catchAsync from '../utils/catchAsync';
import { productService } from '../services';

interface QueryParams {
  sortBy?: string;
  limit?: string;
  page?: string;
  name?: string;
  category?: string;
  inStock?: string;
  userId?: string;
}
```

**Create Controller:**
```typescript
const createProduct = catchAsync(async (req: Request, res: Response) => {
  // Add the authenticated user's ID to the product data
  const productData = {
    ...req.body,
    userId: req.user.id, // From auth middleware
  };
  
  const product = await productService.createProduct(productData);
  res.status(httpStatus.CREATED).send(product);
});
```

**Query Controller with Filtering:**
```typescript
const getProducts = catchAsync(async (req: Request, res: Response) => {
  // Extract filter parameters
  const { name, category, inStock, userId } = req.query;
  const filter = { name, category, inStock, userId } as Record<string, string | undefined>;

  const { sortBy, limit, page } = req.query as QueryParams;
  const options: { sortBy?: string; limit?: string; page?: string } = {};
  if (sortBy !== undefined) options.sortBy = sortBy;
  if (limit !== undefined) options.limit = limit;
  if (page !== undefined) options.page = page;

  const result = await productService.queryProducts(filter, options);
  res.send(result);
});
```

**Controller with Authorization Check:**
```typescript
const updateProduct = catchAsync(async (req: Request, res: Response) => {
  if (!req.params.productId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Product ID is required');
  }
  
  // Check if user owns the product or is admin
  const isOwner = await productService.isProductOwner(req.params.productId, req.user.id);
  if (!isOwner && req.user.role !== 'ADMIN') {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only update your own products');
  }
  
  const product = await productService.updateProductById(req.params.productId, req.body);
  res.send(product);
});
```

## ✅ Validation Development

Use Zod schemas for type-safe request validation.

### Validation Patterns

```typescript
// src/validations/product.validation.ts
import { z } from 'zod';
import { uuid } from './custom.validation';

const createProduct = {
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    price: z.number().positive('Price must be positive'),
    description: z.string().max(500, 'Description too long').optional(),
    category: z.string().min(1, 'Category is required').max(50, 'Category too long'),
    inStock: z.boolean().optional(),
  }),
};
```

**Security-First Query Validation:**
```typescript
// Allowed fields for sorting to prevent injection
const allowedSortFields = ['name', 'price', 'category', 'createdAt', 'updatedAt'] as const;
const sortFieldPattern = new RegExp(`^(${allowedSortFields.join('|')}):(asc|desc)$`);

const getProducts = {
  query: z.object({
    name: z.string().min(1).max(100).optional(),
    category: z.string().min(1).max(50).optional(),
    inStock: z.enum(['true', 'false']).optional(),
    userId: uuid.optional(),
    sortBy: z
      .string()
      .refine(
        (value) => sortFieldPattern.test(value),
        'sortBy must be in format "field:direction" where field is one of: ' +
          allowedSortFields.join(', ') +
          ' and direction is asc or desc'
      )
      .optional(),
    limit: z.coerce.number().int().positive().max(100).default(10).optional(),
    page: z.coerce.number().int().positive().max(1000).default(1).optional(),
  }),
};
```

**Update Validation with Refinements:**
```typescript
const updateProduct = {
  params: z.object({
    productId: uuid,
  }),
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      price: z.number().positive().optional(),
      description: z.string().max(500).optional(),
      category: z.string().min(1).max(50).optional(),
      inStock: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
};

export { createProduct, getProducts, updateProduct };
```

## 🛣️ Route Development

Routes wire together authentication, validation, and controllers.

### Route Patterns

```typescript
// src/routes/v1/product.route.ts
import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import * as productValidation from '../../validations/product.validation';
import * as productController from '../../controllers/product.controller';

const router = express.Router();
```

**Middleware Order (Critical!):**
```typescript
router
  .route('/')
  .post(
    auth(),                               // 1. Authentication required
    validate(productValidation.createProduct), // 2. Validation
    productController.createProduct       // 3. Controller
  )
  .get(
    validate(productValidation.getProducts),   // Public endpoint, no auth required
    productController.getProducts
  );

router
  .route('/:productId')
  .get(
    validate(productValidation.getProduct),    // Public endpoint
    productController.getProduct
  )
  .patch(
    auth(),                              // Must be authenticated
    validate(productValidation.updateProduct),
    productController.updateProduct      // Ownership check in controller
  )
  .delete(
    auth(),                              // Must be authenticated
    validate(productValidation.deleteProduct),
    productController.deleteProduct      // Ownership check in controller
  );

export default router;
```

**Route Registration:**
```typescript
// src/routes/v1/index.ts
import productRoute from './product.route';

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/products',    // Add your new routes
    route: productRoute,
  },
];
```

## 🔐 Authentication & Authorization

### Authentication Middleware

```typescript
// Basic authentication
router.get('/protected', auth(), controller.handler);

// Permission-based authentication
router.get('/admin', auth('manageUsers'), controller.adminHandler);

// Resource ownership (checked in controller)
router.patch('/users/:id', auth('getUsers'), controller.updateUser);
```

### Authorization Patterns

**Owner-Only Access:**
```typescript
const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const isOwner = await productService.isProductOwner(req.params.productId, req.user.id);
  if (!isOwner && req.user.role !== 'ADMIN') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  }
  
  // Proceed with update
});
```

**Dynamic Permission Checking:**
```typescript
// Service layer helper
const isProductOwner = async (productId: string, userId: string): Promise<boolean> => {
  if (!isValidUuid(productId) || !isValidUuid(userId)) {
    return false;
  }

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      userId: userId,
    },
  });

  return !!product;
};
```

## 🚨 Error Handling Best Practices

### Service Layer Errors

```typescript
// Always use ApiError for consistent responses
throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid input data');
throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
```

### Controller Error Handling

```typescript
// Always use catchAsync wrapper
const controller = catchAsync(async (req: Request, res: Response) => {
  // Any thrown error is automatically caught and handled
  const result = await service.performOperation();
  res.send(result);
});
```

### Validation Errors

Zod automatically provides detailed validation errors:

```json
{
  "code": 400,
  "message": "\"name\" is required. \"price\" must be a positive number."
}
```

## 📊 Performance Optimization

### Database Query Optimization

```typescript
// Use select to limit returned fields
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, name: true, email: true }
});

// Use include only for necessary relationships
const productWithUser = await prisma.product.findUnique({
  where: { id },
  include: { user: true }  // Only if you need user data
});

// Parallel queries for better performance
const [totalResults, results] = await Promise.all([
  prisma.product.count({ where }),
  prisma.product.findMany({ where, skip, take: limit })
]);
```

### Caching Strategies

```typescript
// Simple in-memory cache for frequently accessed data
const cache = new Map();

const getCachedUser = async (userId: string) => {
  const cacheKey = `user:${userId}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  const user = await prisma.user.findUnique({ where: { id: userId } });
  cache.set(cacheKey, user);
  
  return user;
};
```

## 📝 API Documentation

### Swagger/OpenAPI Documentation

```typescript
/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a product
 *     description: Create a new product. Only authenticated users can create products.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               price:
 *                 type: number
 *                 minimum: 0.01
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               category:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *               inStock:
 *                 type: boolean
 *             example:
 *               name: Laptop
 *               price: 999.99
 *               description: High-performance laptop
 *               category: Electronics
 *               inStock: true
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
```

## 🧪 Testing Your APIs

Write comprehensive tests for your APIs. See the [Testing Guide](TESTING-GUIDE.md) for detailed examples.

**Quick Test Example:**
```typescript
// Integration test
describe('POST /v1/products', () => {
  test('should return 201 and create product when authenticated', async () => {
    await insertUsers([userOne]);

    const productData = {
      name: 'Test Product',
      price: 99.99,
      category: 'Electronics',
    };

    const res = await request(app)
      .post('/v1/products')
      .set('Authorization', `Bearer ${userOneAccessToken}`)
      .send(productData)
      .expect(httpStatus.CREATED);

    expect(res.body).toMatchObject(productData);
    expect(res.body).toHaveProperty('id');
  });
});
```

## ✅ Development Checklist

When creating new APIs:

- [ ] **Database schema** updated and migrations created
- [ ] **Service layer** with comprehensive business logic and validation
- [ ] **Controller layer** handling HTTP concerns only
- [ ] **Validation schemas** for all inputs with security considerations  
- [ ] **Routes** with proper authentication and authorization
- [ ] **Error handling** using ApiError class consistently
- [ ] **Unit tests** for service layer functions
- [ ] **Integration tests** for API endpoints
- [ ] **Swagger documentation** for all endpoints
- [ ] **Security review** - input validation, authorization checks
- [ ] **Performance check** - query optimization, response times

---

**Next: Learn how to add complete new entities with the [Adding New Entities Guide](ADDING-ENTITIES.md)**