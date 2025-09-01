import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string({ message: 'PostgreSQL database URL is required' }),
  JWT_SECRET: z.string({ message: 'JWT secret key is required' }),
  JWT_ACCESS_EXPIRATION_MINUTES: z.coerce.number().default(30),
  JWT_REFRESH_EXPIRATION_DAYS: z.coerce.number().default(30),
  JWT_RESET_PASSWORD_EXPIRATION_MINUTES: z.coerce.number().default(10),
  JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: z.coerce.number().default(10),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USERNAME: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

const envVarsResult = envVarsSchema.safeParse(process.env);

if (!envVarsResult.success) {
  const errors = envVarsResult.error.issues.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`).join(', ');
  throw new Error(`Config validation error: ${errors}`);
}

const envVars = envVarsResult.data;

interface Config {
  env: string;
  port: number;
  database: {
    url: string;
  };
  jwt: {
    secret: string;
    accessExpirationMinutes: number;
    refreshExpirationDays: number;
    resetPasswordExpirationMinutes: number;
    verifyEmailExpirationMinutes: number;
  };
  email: {
    smtp: {
      host: string | undefined;
      port: number | undefined;
      auth: {
        user: string | undefined;
        pass: string | undefined;
      };
    };
    from: string | undefined;
  };
}

const config: Config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  database: {
    url: envVars.DATABASE_URL,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },
};

export default config;
