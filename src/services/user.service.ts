import { User, Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import ApiError from '../utils/ApiError';
import { FilterObject } from '../types/auth.types';
import { QueryOptions, QueryResult } from '../types/pagination.types';
import { validatePagination, validateSort, isValidEmail, isValidUuid } from '../utils/validation';

interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role?: 'USER' | 'ADMIN';
  isEmailVerified?: boolean;
}

interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  role?: 'USER' | 'ADMIN';
  isEmailVerified?: boolean;
}

/**
 * Check if email is taken
 * @param email - User email
 * @param excludeUserId - User ID to exclude from check
 * @returns Promise<boolean>
 */
const isEmailTaken = async (email: string, excludeUserId?: string): Promise<boolean> => {
  const where: Prisma.UserWhereInput = { email };
  if (excludeUserId) {
    where.NOT = { id: excludeUserId };
  }

  const user = await prisma.user.findFirst({ where });
  return !!user;
};

/**
 * Create a user
 * @param userBody - User data
 * @returns Promise<User>
 */
const createUser = async (userBody: CreateUserData): Promise<User> => {
  // Validate email format
  if (!isValidEmail(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid email format');
  }

  if (await isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(userBody.password, 8);

  const user = await prisma.user.create({
    data: {
      ...userBody,
      password: hashedPassword,
      role: userBody.role || 'USER',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user as User;
};

/**
 * Check if password matches
 * @param user - User object
 * @param password - Password to check
 * @returns Promise<boolean>
 */
const isPasswordMatch = async (user: User, password: string): Promise<boolean> => {
  return bcrypt.compare(password, user.password);
};

/**
 * Query for users with pagination
 * @param filter - Filter criteria
 * @param options - Query options
 * @returns Promise<QueryResult<User>>
 */
const queryUsers = async (filter: FilterObject, options: QueryOptions): Promise<QueryResult<User>> => {
  // Validate and sanitize pagination
  const { page, limit } = validatePagination(options.page, options.limit);
  const skip = (page - 1) * limit;

  // Build where clause with input sanitization
  const where: Prisma.UserWhereInput = {};
  if (filter.name && typeof filter.name === 'string') {
    // Sanitize name filter to prevent injection
    const sanitizedName = filter.name.trim().slice(0, 100); // Limit length and trim
    if (sanitizedName.length > 0) {
      where.name = { contains: sanitizedName, mode: 'insensitive' };
    }
  }
  if (filter.role && ['USER', 'ADMIN'].includes(filter.role as string)) {
    where.role = filter.role as 'USER' | 'ADMIN';
  }

  // Build orderBy clause with whitelist validation for security
  const allowedSortFields = ['name', 'email', 'role', 'createdAt', 'updatedAt'] as const;
  let orderBy: Prisma.UserOrderByWithRelationInput = { createdAt: 'asc' };

  const sortValidation = validateSort(options.sortBy, allowedSortFields);
  if (sortValidation) {
    orderBy = { [sortValidation.field]: sortValidation.order } as Prisma.UserOrderByWithRelationInput;
  }

  const [totalResults, results] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: limit,
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
 * Get user by id
 * @param id - User ID
 * @returns Promise<User | null>
 */
const getUserById = async (id: string): Promise<User | null> => {
  // Validate UUID format
  if (!isValidUuid(id)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID format');
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
      password: false,
    },
  });

  return user as User | null;
};

/**
 * Get user by email (without password for security)
 * @param email - User email
 * @returns Promise<User | null>
 */
const getUserByEmail = async (email: string): Promise<User | null> => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user as User | null;
};

/**
 * Get user by email with password (for authentication only)
 * @param email - User email
 * @returns Promise<User | null>
 */
const getUserByEmailWithPassword = async (email: string): Promise<User | null> => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  return user;
};

/**
 * Update user by id
 * @param userId - User ID
 * @param updateBody - Update data
 * @returns Promise<User>
 */
const updateUserById = async (userId: string, updateBody: UpdateUserData): Promise<User> => {
  // Validate UUID format
  if (!isValidUuid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID format');
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Validate email format if provided
  if (updateBody.email && !isValidEmail(updateBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid email format');
  }

  if (updateBody.email && (await isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  // Hash password if provided
  const updateData = { ...updateBody };
  if (updateData.password) {
    updateData.password = await bcrypt.hash(updateData.password, 8);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  return updatedUser;
};

/**
 * Delete user by id
 * @param userId - User ID
 * @returns Promise<User>
 */
const deleteUserById = async (userId: string): Promise<User> => {
  // Validate UUID format
  if (!isValidUuid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID format');
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const deletedUser = await prisma.user.delete({
    where: { id: userId },
  });

  return deletedUser;
};

export default {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  getUserByEmailWithPassword,
  updateUserById,
  deleteUserById,
  isEmailTaken,
  isPasswordMatch,
};
