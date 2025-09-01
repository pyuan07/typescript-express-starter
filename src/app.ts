import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import passport from 'passport';
import httpStatus from 'http-status';
import config from './config/config';
import { successHandler, errorHandler } from './config/morgan';
import { jwtStrategy } from './config/passport';
import { authLimiter, generalLimiter } from './middlewares/rateLimiter';
import sanitizeInput from './middlewares/sanitize';
import routes from './routes/v1';
import { errorConverter, errorHandler as errorHandlerMiddleware } from './middlewares/error';
import ApiError from './utils/ApiError';

const app = express();

if (config.env !== 'test') {
  app.use(successHandler);
  app.use(errorHandler);
}

// set security HTTP headers
app.use(helmet());

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// sanitize input to prevent injection attacks
app.use(sanitizeInput);

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
app.options('*', cors());

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// Apply rate limiting
if (config.env === 'production') {
  app.use('/v1/auth', authLimiter);
  app.use('/v1', generalLimiter);
}

// v1 api routes
app.use('/v1', routes);

// send back a 404 error for any unknown api request
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandlerMiddleware);

export default app;
