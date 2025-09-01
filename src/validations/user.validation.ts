import { z } from 'zod';
import { password, uuid, email } from './custom.validation';

const createUser = {
  body: z.object({
    email: email,
    password: password,
    name: z.string().min(1, 'name is required'),
    role: z.enum(['USER', 'ADMIN'], { message: 'role must be either USER or ADMIN' }),
  }),
};

// Allowed fields for sorting to prevent SQL injection
const allowedSortFields = ['name', 'email', 'role', 'createdAt', 'updatedAt'] as const;
const sortFieldPattern = new RegExp(`^(${allowedSortFields.join('|')}):(asc|desc)$`);

const getUsers = {
  query: z.object({
    name: z.string().min(1).max(100).optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
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

const getUser = {
  params: z.object({
    userId: uuid,
  }),
};

const updateUser = {
  params: z.object({
    userId: uuid,
  }),
  body: z
    .object({
      email: email.optional(),
      password: password.optional(),
      name: z.string().min(1).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
};

const deleteUser = {
  params: z.object({
    userId: uuid,
  }),
};

export { createUser, getUsers, getUser, updateUser, deleteUser };
