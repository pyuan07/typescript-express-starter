import httpStatus from 'http-status';
import { Request, Response, NextFunction } from 'express';
import config from '../config/config';
import logger from '../config/logger';
import ApiError from '../utils/ApiError';

interface ErrorResponse {
  code: number;
  message: string;
  stack?: string;
}

const errorConverter = (err: Error | ApiError, _req: Request, _res: Response, next: NextFunction): void => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    const message =
      error.message || (httpStatus[statusCode as keyof typeof httpStatus] as string) || 'Internal Server Error';
    error = new ApiError(statusCode, message, false, err.stack);
  }
  next(error);
};

const errorHandler = (err: ApiError, _req: Request, res: Response, _next: NextFunction): void => {
  let { statusCode, message } = err;
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR] as string;
  }

  res.locals.errorMessage = err.message;

  const response: ErrorResponse = {
    code: statusCode,
    message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  if (config.env === 'development') {
    logger.error(err);
  }

  res.status(statusCode).send(response);
};

export { errorConverter, errorHandler };
