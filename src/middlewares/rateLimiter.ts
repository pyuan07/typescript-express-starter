import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for auth endpoints
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts, please try again later.',
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs for general endpoints
  message: 'Too many requests from this IP, please try again later.',
});

export { authLimiter, generalLimiter };
