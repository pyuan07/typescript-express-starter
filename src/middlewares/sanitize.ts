import { Request, Response, NextFunction } from 'express';

/**
 * Sanitize string values to prevent injection attacks
 * @param value - The value to sanitize
 * @returns Sanitized string
 */
const sanitizeString = (value: string): string => {
  return value
    .trim()
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous HTML/SQL characters
    .slice(0, 1000); // Limit length to prevent DoS
};

/**
 * Recursively sanitize an object
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
const sanitizeObject = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize both key and value
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
};

/**
 * Express middleware to sanitize request data
 */
const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query) as typeof req.query;
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params) as typeof req.params;
    }

    next();
  } catch (error) {
    // If sanitization fails, reject the request
    next(new Error('Invalid request data'));
  }
};

export default sanitizeInput;
