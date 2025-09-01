import { validate as validateUuid } from 'uuid';

/**
 * Validate if a string is a valid CUID (used by Prisma)
 * CUIDs have the format: c[0-9a-z]{24} (25 total characters)
 * @param cuid - String to validate
 * @returns boolean indicating if the string is a valid CUID
 */
export const isValidCuid = (cuid: string): boolean => {
  if (!cuid || typeof cuid !== 'string') {
    return false;
  }
  // CUID format: starts with 'c' followed by 24 alphanumeric characters (25 total)
  const cuidRegex = /^c[a-z0-9]{24}$/;
  return cuidRegex.test(cuid);
};

/**
 * Validate if a string is a valid UUID v4 or CUID
 * @param id - String to validate
 * @returns boolean indicating if the string is a valid ID
 */
export const isValidUuid = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  // Check if it's a valid UUID or CUID (Prisma default)
  return validateUuid(id) || isValidCuid(id);
};

/**
 * Validate and sanitize email address
 * @param email - Email string to validate
 * @returns boolean indicating if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email regex - for production, consider using a dedicated library like validator.js
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase()) && email.length <= 255;
};

/**
 * Sanitize and validate string input
 * @param input - String to validate
 * @param maxLength - Maximum allowed length
 * @param minLength - Minimum required length
 * @returns Sanitized string or null if invalid
 */
export const sanitizeString = (input: string, maxLength: number = 1000, minLength: number = 0): string | null => {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const sanitized = input
    .trim()
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous HTML/SQL characters
    .slice(0, maxLength);

  return sanitized.length >= minLength ? sanitized : null;
};

/**
 * Validate pagination parameters
 * @param page - Page number
 * @param limit - Items per page
 * @returns Validated pagination object
 */
export const validatePagination = (page?: string | number, limit?: string | number): { page: number; limit: number } => {
  const parsedPage = Math.max(1, parseInt(String(page || '1'), 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit || '10'), 10) || 10));

  return { page: parsedPage, limit: parsedLimit };
};

/**
 * Validate sort parameters against allowed fields
 * @param sortBy - Sort string in format "field:order"
 * @param allowedFields - Array of allowed field names
 * @returns Validated sort object or null
 */
export const validateSort = (
  sortBy?: string,
  allowedFields: readonly string[] = []
): { field: string; order: 'asc' | 'desc' } | null => {
  if (!sortBy || typeof sortBy !== 'string') {
    return null;
  }

  const [field, order] = sortBy.split(':');

  if (!field || !order || !allowedFields.includes(field) || !['asc', 'desc'].includes(order)) {
    return null;
  }

  return { field, order: order as 'asc' | 'desc' };
};
