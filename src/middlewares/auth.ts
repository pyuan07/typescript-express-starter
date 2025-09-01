import passport from 'passport';
import httpStatus from 'http-status';
import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import ApiError from '../utils/ApiError';
import { roleRights, Permission } from '../config/roles';
import { PassportError, PassportInfo } from '../types/auth.types';
import { isValidUuid } from '../utils/validation';

const verifyCallback =
  (
    req: Request,
    resolve: () => void,
    reject: (error: ApiError) => void,
    requiredRights: Permission[],
    allowSelfAccess: boolean = false
  ) =>
  async (err: PassportError | null, user: User | false, info: PassportInfo | null): Promise<void> => {
    if (err || info || !user) {
      return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
    }

    req.user = user;

    // If no specific rights required, just authenticate
    if (requiredRights.length === 0) {
      return resolve();
    }

    const userRights = Array.from(roleRights.get(user.role) || []) as string[];
    const hasRequiredRights = requiredRights.every((requiredRight) => userRights.includes(requiredRight));

    // Check if user has required permissions
    if (hasRequiredRights) {
      return resolve();
    }

    // Check self-access for resource ownership
    if (allowSelfAccess && req.params?.userId) {
      // Validate that userId is a valid UUID to prevent injection
      if (!isValidUuid(req.params.userId)) {
        return reject(new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID format'));
      }
      if (req.params.userId === user.id) {
        return resolve();
      }
    }

    return reject(new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions'));
  };

// Main auth middleware
const auth =
  (...requiredRights: Permission[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject, requiredRights))(req, res, next);
    })
      .then(() => next())
      .catch((err) => next(err));
  };

// Auth middleware that allows self-access (user can access their own resources)
const authWithSelfAccess =
  (...requiredRights: Permission[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject, requiredRights, true))(
        req,
        res,
        next
      );
    })
      .then(() => next())
      .catch((err) => next(err));
  };

// Middleware to ensure user can only access their own resources
const requireSelfOrAdmin = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const { user } = req;
  if (!user) {
    return next(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
  }

  // Validate userId format if present
  if (req.params?.userId && !isValidUuid(req.params.userId)) {
    return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID format'));
  }

  // Admins can access any resource
  const userRights = Array.from(roleRights.get((user as User).role) || []) as string[];
  if (userRights.includes('manageUsers')) {
    return next();
  }

  // Regular users can only access their own resources
  if (req.params?.userId && req.params.userId !== (user as User).id) {
    return next(new ApiError(httpStatus.FORBIDDEN, 'Access denied'));
  }

  next();
};

export default auth;
export { authWithSelfAccess, requireSelfOrAdmin };
