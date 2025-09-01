# Adding New Entities Guide

Step-by-step guide for adding new database models and complete CRUD APIs to your TypeScript starter.

## 📋 Overview: The 8-Step Process

1. **[Database Layer](#step-1-database-layer)** - Add Prisma model
2. **[Service Layer](#step-2-service-layer)** - Create business logic with CRUD operations  
3. **[Controller Layer](#step-3-controller-layer)** - Handle HTTP requests/responses
4. **[Validation Layer](#step-4-validation-layer)** - Create Zod schemas
5. **[Route Layer](#step-5-route-layer)** - Define API endpoints with middleware
6. **[Integration](#step-6-integration)** - Export services and register routes
7. **[Testing](#step-7-testing)** - Write unit and integration tests
8. **[Verification](#step-8-verification)** - Test your new API

## 🎯 Example: Adding a Product Entity

We'll build a complete **Product** entity with these features:

- **Fields**: name, price, description, category, inStock, userId (owner)
- **Access Rules**: 
  - Anyone can view products (GET)
  - Authenticated users can create (POST)
  - Only owner or admin can update/delete (PATCH/DELETE)

### Files You'll Create/Modify

**New Files:**
```
src/services/product.service.ts       # Business logic
src/controllers/product.controller.ts # HTTP handlers  
src/validations/product.validation.ts # Zod schemas
src/routes/v1/product.route.ts        # API endpoints
tests/fixtures/product.fixture.ts     # Test data
tests/unit/services/product.service.test.ts    # Unit tests
tests/integration/product.test.ts     # Integration tests
```

**Modified Files:**
```
prisma/schema.prisma            # Add Product model
src/services/index.ts           # Export service
src/controllers/index.ts        # Export controller
src/validations/index.ts        # Export validation
src/routes/v1/index.ts          # Register routes
```

---

## Step 1: Database Layer

**📁 File to Edit:** `prisma/schema.prisma`

### Add the Product Model

```prisma
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
```

### Update User Model for Relationships

```prisma
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
  products        Product[] // Add this line

  @@map("users")
}
```

### Apply Database Changes

```bash
# Generate Prisma client with new model
npm run db:generate

# Apply schema changes to database (development)
npm run db:push

# Verify changes in Prisma Studio (optional)
npm run db:studio
```

---

## Step 2: Service Layer

**📁 File to Create:** `src/services/product.service.ts`

```typescript
import { Product, Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import prisma from '../config/database';
import ApiError from '../utils/ApiError';
import { FilterObject } from '../types/auth.types';
import { QueryOptions, QueryResult } from '../types/pagination.types';
import { validatePagination, validateSort, isValidUuid } from '../utils/validation';

interface CreateProductData {
  name: string;
  price: number;
  description?: string;
  category: string;
  inStock?: boolean;
  userId: string;
}

interface UpdateProductData {
  name?: string;
  price?: number;
  description?: string;
  category?: string;
  inStock?: boolean;
}

/**
 * Create a product
 */
const createProduct = async (productBody: CreateProductData): Promise<Product> => {
  // Validate userId format
  if (!isValidUuid(productBody.userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID format');
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: productBody.userId },
  });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Check if product name is already taken
  const existingProduct = await prisma.product.findFirst({
    where: { name: productBody.name },
  });
  if (existingProduct) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Product name already exists');
  }

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

/**
 * Query for products with pagination and filtering
 */
const queryProducts = async (filter: FilterObject, options: QueryOptions): Promise<QueryResult<Product>> => {
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
  
  if (filter.userId && typeof filter.userId === 'string' && isValidUuid(filter.userId)) {
    where.userId = filter.userId;
  }

  // Build orderBy clause with whitelist validation for security
  const allowedSortFields = ['name', 'price', 'category', 'createdAt', 'updatedAt'] as const;
  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };

  const sortValidation = validateSort(options.sortBy, allowedSortFields);
  if (sortValidation) {
    orderBy = { [sortValidation.field]: sortValidation.order } as Prisma.ProductOrderByWithRelationInput;
  }

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

/**
 * Get product by id
 */
const getProductById = async (id: string): Promise<Product | null> => {
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
        },
      },
    },
  });

  return product;
};

/**
 * Update product by id
 */
const updateProductById = async (productId: string, updateBody: UpdateProductData): Promise<Product> => {
  if (!isValidUuid(productId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid product ID format');
  }

  const product = await getProductById(productId);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }

  // Check if new name conflicts with existing product
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

/**
 * Delete product by id
 */
const deleteProductById = async (productId: string): Promise<Product> => {
  if (!isValidUuid(productId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid product ID format');
  }

  const product = await getProductById(productId);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }

  const deletedProduct = await prisma.product.delete({
    where: { id: productId },
  });

  return deletedProduct;
};

/**
 * Check if user owns the product
 */
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

export default {
  createProduct,
  queryProducts,
  getProductById,
  updateProductById,
  deleteProductById,
  isProductOwner,
};
```

---

## Step 3: Controller Layer

**📁 File to Create:** `src/controllers/product.controller.ts`

```typescript
import httpStatus from 'http-status';
import { Request, Response } from 'express';
import ApiError from '../utils/ApiError';
import catchAsync from '../utils/catchAsync';
import { productService } from '../services';

interface QueryParams {
  [key: string]: unknown;
  sortBy?: string;
  limit?: string;
  page?: string;
  name?: string;
  category?: string;
  inStock?: string;
  userId?: string;
}

const createProduct = catchAsync(async (req: Request, res: Response) => {
  // Add the authenticated user's ID to the product data
  const productData = {
    ...req.body,
    userId: req.user.id, // From auth middleware
  };
  
  const product = await productService.createProduct(productData);
  res.status(httpStatus.CREATED).send(product);
});

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

const getProduct = catchAsync(async (req: Request, res: Response) => {
  if (!req.params.productId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Product ID is required');
  }
  
  const product = await productService.getProductById(req.params.productId);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }
  
  res.send(product);
});

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

const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  if (!req.params.productId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Product ID is required');
  }
  
  // Check if user owns the product or is admin
  const isOwner = await productService.isProductOwner(req.params.productId, req.user.id);
  if (!isOwner && req.user.role !== 'ADMIN') {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only delete your own products');
  }
  
  await productService.deleteProductById(req.params.productId);
  res.status(httpStatus.NO_CONTENT).send();
});

export { createProduct, getProducts, getProduct, updateProduct, deleteProduct };
```

---

## Step 4: Validation Layer

**📁 File to Create:** `src/validations/product.validation.ts`

```typescript
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

const getProduct = {
  params: z.object({
    productId: uuid,
  }),
};

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

const deleteProduct = {
  params: z.object({
    productId: uuid,
  }),
};

export { createProduct, getProducts, getProduct, updateProduct, deleteProduct };
```

---

## Step 5: Route Layer

**📁 File to Create:** `src/routes/v1/product.route.ts`

```typescript
import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import * as productValidation from '../../validations/product.validation';
import * as productController from '../../controllers/product.controller';

const router = express.Router();

router
  .route('/')
  .post(
    auth(), // Authentication required
    validate(productValidation.createProduct), // Validation
    productController.createProduct
  )
  .get(
    validate(productValidation.getProducts), // Public endpoint, no auth required
    productController.getProducts
  );

router
  .route('/:productId')
  .get(
    validate(productValidation.getProduct), // Public endpoint
    productController.getProduct
  )
  .patch(
    auth(), // Must be authenticated
    validate(productValidation.updateProduct),
    productController.updateProduct // Ownership check in controller
  )
  .delete(
    auth(), // Must be authenticated
    validate(productValidation.deleteProduct),
    productController.deleteProduct // Ownership check in controller
  );

export default router;
```

---

## Step 6: Integration

Export your new services, controllers, and validations, then register routes.

**Update `src/services/index.ts`:**
```typescript
export { default as authService } from './auth.service';
export { default as emailService } from './email.service';
export { default as tokenService } from './token.service';
export { default as userService } from './user.service';
export { default as productService } from './product.service'; // Add this line
```

**Update `src/controllers/index.ts`:**
```typescript
export * from './auth.controller';
export * from './user.controller';
export * from './product.controller'; // Add this line
```

**Update `src/validations/index.ts`:**
```typescript
export * from './auth.validation';
export * from './user.validation';
export * from './product.validation'; // Add this line
export * from './custom.validation';
```

**Update `src/routes/v1/index.ts`:**
```typescript
import express from 'express';
import authRoute from './auth.route';
import userRoute from './user.route';
import productRoute from './product.route'; // Add this line
import docsRoute from './docs.route';
import healthRoute from './health.route';
import config from '../../config/config';

const router = express.Router();

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
    path: '/products', // Add this route
    route: productRoute,
  },
  {
    path: '/health',
    route: healthRoute,
  },
];

// ... rest of the file remains the same
```

---

## Step 7: Testing

Write comprehensive tests for your new entity.

**Create `tests/fixtures/product.fixture.ts`:**
```typescript
import { Product } from '@prisma/client';

const productOne: Partial<Product> & { userId: string } = {
  name: 'Test Product 1',
  price: 99.99,
  description: 'Test product description',
  category: 'Electronics',
  inStock: true,
  userId: 'user-id-1', // Will be replaced with actual user ID
};

const productTwo: Partial<Product> & { userId: string } = {
  name: 'Test Product 2',
  price: 149.99,
  description: 'Another test product',
  category: 'Clothing',
  inStock: false,
  userId: 'user-id-2', // Will be replaced with actual user ID
};

export { productOne, productTwo };
```

**Create Unit Tests `tests/unit/services/product.service.test.ts`:**
```typescript
import { PrismaClient } from '@prisma/client';
import productService from '../../../src/services/product.service';
import { productOne } from '../../fixtures/product.fixture';
import { userOne, insertUsers } from '../../fixtures/user.fixture';
import setupTestDB from '../../utils/setupTestDB';

setupTestDB();

describe('Product service', () => {
  let testUser: any;

  beforeEach(async () => {
    const [user] = await insertUsers([userOne]);
    testUser = user;
  });

  describe('createProduct', () => {
    test('should create a product', async () => {
      const productData = {
        ...productOne,
        userId: testUser.id,
      };

      const product = await productService.createProduct(productData);

      expect(product).toMatchObject({
        name: productData.name,
        price: productData.price,
        category: productData.category,
        inStock: productData.inStock,
        userId: testUser.id,
      });
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('createdAt');
      expect(product).toHaveProperty('updatedAt');
    });

    test('should throw error if product name already exists', async () => {
      const productData = {
        ...productOne,
        userId: testUser.id,
      };

      await productService.createProduct(productData);
      await expect(productService.createProduct(productData)).rejects.toThrow('Product name already exists');
    });
  });

  describe('getProductById', () => {
    test('should return product if found', async () => {
      const productData = {
        ...productOne,
        userId: testUser.id,
      };
      const createdProduct = await productService.createProduct(productData);

      const product = await productService.getProductById(createdProduct.id);

      expect(product).toBeDefined();
      expect(product?.id).toBe(createdProduct.id);
    });

    test('should return null if product not found', async () => {
      const product = await productService.getProductById('507f1f77bcf86cd799439011');
      expect(product).toBeNull();
    });
  });
});
```

**Create Integration Tests `tests/integration/product.test.ts`:**
```typescript
import request from 'supertest';
import httpStatus from 'http-status';
import app from '../../src/app';
import setupTestDB from '../utils/setupTestDB';
import { productOne } from '../fixtures/product.fixture';
import { userOne, insertUsers } from '../fixtures/user.fixture';
import { userOneAccessToken } from '../fixtures/token.fixture';

setupTestDB();

describe('Product routes', () => {
  describe('POST /v1/products', () => {
    test('should return 201 and create product when authenticated', async () => {
      await insertUsers([userOne]);

      const productData = {
        name: 'Test Product',
        price: 99.99,
        description: 'Test description',
        category: 'Electronics',
        inStock: true,
      };

      const res = await request(app)
        .post('/v1/products')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(productData)
        .expect(httpStatus.CREATED);

      expect(res.body).toMatchObject({
        name: productData.name,
        price: productData.price,
        category: productData.category,
        inStock: productData.inStock,
      });
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('userId');
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .post('/v1/products')
        .send(productOne)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /v1/products', () => {
    test('should return 200 and products list', async () => {
      const users = await insertUsers([userOne]);
      
      // Create a product for testing
      await request(app)
        .post('/v1/products')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(productOne);

      const res = await request(app)
        .get('/v1/products')
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('results');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 10);
      expect(res.body.results).toHaveLength(1);
    });
  });
});
```

---

## Step 8: Verification

### Run Quality Checks

```bash
# TypeScript compilation
npm run typecheck

# Code linting
npm run lint

# Code formatting
npm run prettier
```

### Run Tests

```bash
# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration

# All tests with coverage
npm run test:coverage
```

### Manual API Testing

```bash
# 1. Start development server
npm run dev

# 2. Register/Login to get access token
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# 3. Create a product (use the access token from step 2)
curl -X POST http://localhost:3000/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"name":"Test Laptop","price":999.99,"category":"Electronics","description":"High-performance laptop"}'

# 4. Get all products (public endpoint)
curl -X GET http://localhost:3000/v1/products

# 5. Get specific product (public endpoint)
curl -X GET http://localhost:3000/v1/products/PRODUCT_ID

# 6. Update product (owner only)
curl -X PATCH http://localhost:3000/v1/products/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"price":899.99,"name":"Updated Laptop"}'

# 7. Delete product (owner only)
curl -X DELETE http://localhost:3000/v1/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Check API Documentation

Visit `http://localhost:3000/v1/docs` to see your new Product endpoints in the interactive Swagger documentation.

## 🎉 Success!

You've successfully added a complete new entity with:

✅ **Database-First Design** - Proper schema with relationships  
✅ **Secure Service Layer** - Input validation and business logic  
✅ **Type-Safe Controllers** - HTTP handling with error management  
✅ **Robust Validation** - Zod schemas preventing bad data  
✅ **Protected API Routes** - Authentication and authorization  
✅ **Complete Integration** - All exports and registrations  
✅ **Comprehensive Testing** - Unit and integration test coverage  
✅ **Manual Verification** - Working API endpoints  

## 🚀 Next Steps

- **Add More Features**: Search, filtering, file uploads
- **Enhance Security**: Rate limiting, advanced permissions  
- **Optimize Performance**: Caching, database indexing
- **Add Relationships**: Connect to other entities
- **Implement Business Logic**: Complex workflows and validations

## 🔄 Pattern Summary

Follow this same 8-step process for any new entity:

```typescript
// 1. Database: Prisma schema
model Entity { ... }

// 2. Service: Business logic
const entityService = {
  create: async (data) => { /* validate, create, return */ },
  query: async (filter, options) => { /* validate, search, paginate */ },
  getById: async (id) => { /* validate ID, find, return */ },
  update: async (id, data) => { /* validate, check ownership, update */ },
  delete: async (id) => { /* validate, check ownership, delete */ },
};

// 3. Controller: HTTP handling
const controller = catchAsync(async (req, res) => {
  const result = await service.method(req.params.id, req.body);
  res.status(httpStatus.OK).send(result);
});

// 4. Validation: Zod schemas
const validation = {
  body: z.object({ field: z.string().min(1) })
};

// 5. Routes: Middleware + Controller
router.route('/').post(auth(), validate(schema), controller);

// 6. Integration: Export and register
// 7. Testing: Unit + Integration tests
// 8. Verification: Manual testing
```

Repeat this process for each new entity you need to add! 🔄

---

**Happy coding! 🚀**