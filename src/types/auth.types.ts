import { User } from '@prisma/client';

// Passport JWT strategy types
export interface JwtPayload {
  sub: string;
  type: string;
  iat: number;
  exp: number;
}

// Auth middleware callback types
export interface PassportError {
  name?: string;
  message?: string;
}

export interface PassportInfo {
  message?: string;
  name?: string;
}

// Auth verification callback parameters
export interface AuthCallbackParams {
  error: PassportError | null;
  user: User | false;
  info: PassportInfo | null;
}

// Validation error types
export interface ValidationError {
  path: string[];
  message: string;
  code?: string;
}

// Generic object with unknown values (replacement for any)
export type UnknownObject = Record<string, unknown>;

// Filter object for queries
export type FilterObject = Record<string, string | number | boolean | undefined>;
