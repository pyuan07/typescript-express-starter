import { z } from 'zod';
import httpStatus from 'http-status';
import { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError';

interface ValidationSchema {
  params?: z.ZodSchema;
  query?: z.ZodSchema;
  body?: z.ZodSchema;
}

const validate =
  (schema: ValidationSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Direct approach - cleaner than using pick utility
      if (schema.params) {
        req.params = schema.params.parse(req.params) as typeof req.params;
      }

      if (schema.query) {
        req.query = schema.query.parse(req.query) as typeof req.query;
      }

      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.issues.map((err: z.ZodIssue) => err.message).join(', ');
        return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
      }
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Validation error'));
    }
  };

export default validate;
