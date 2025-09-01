import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { TokenType } from '@prisma/client';
import httpStatus from 'http-status';
import config from '../config/config';
import { userService } from '../services';
import ApiError from '../utils/ApiError';
import { roleRights, Permission } from '../config/roles';
import { isValidUuid } from '../utils/validation';

interface JwtPayload {
  sub: string;
  type: TokenType;
  iat: number;
  exp: number;
}

interface AuthOptions {
  permissions?: Permission[];
  allowSelfAccess?: boolean;
  optional?: boolean; // Allow unauthenticated access
}

/**
 * Modern, simplified authentication middleware
 * Replaces the complex passport-based approach with direct JWT handling
 */
const auth = (options: AuthOptions = {}) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract token from header
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        if (options.optional) return next();
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Access token required');
      }

      // Verify and decode token
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

      // Validate token type
      if (decoded.type !== TokenType.ACCESS) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token type');
      }

      // Get user from database
      const user = await userService.getUserById(decoded.sub);
      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'User not found');
      }

      // Attach user to request
      req.user = user;

      // Check permissions if required
      if (options.permissions && options.permissions.length > 0) {
        const userRights = Array.from(roleRights.get(user.role) || []);
        const hasPermissions = options.permissions.every((permission) => userRights.includes(permission));

        if (!hasPermissions) {
          // Check self-access if allowed
          if (options.allowSelfAccess && req.params?.userId) {
            if (!isValidUuid(req.params.userId)) {
              throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID format');
            }
            if (req.params.userId !== user.id) {
              throw new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions');
            }
          } else {
            throw new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions');
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Convenience wrappers for common patterns
export const requireAuth = () => auth();
export const requireAdmin = () => auth({ permissions: ['manageUsers'] });
export const requireSelfOrAdmin = () => auth({ permissions: ['manageUsers'], allowSelfAccess: true });
export const optionalAuth = () => auth({ optional: true });

export default auth;
