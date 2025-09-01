import { z } from 'zod';

const password = z
  .string()
  .min(8, 'password must be at least 8 characters')
  .max(128, 'password must not exceed 128 characters')
  .regex(/[a-z]/, 'password must contain at least 1 lowercase letter')
  .regex(/[A-Z]/, 'password must contain at least 1 uppercase letter')
  .regex(/\d/, 'password must contain at least 1 number')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'password must contain at least 1 special character');

const uuid = z.string().uuid('must be a valid UUID');

const email = z.string().email('must be a valid email');

export { password, uuid, email };
