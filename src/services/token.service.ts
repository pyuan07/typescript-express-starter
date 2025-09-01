import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import httpStatus from 'http-status';
import { User, Token, TokenType } from '@prisma/client';
import config from '../config/config';
import userService from './user.service';
import prisma from '../config/database';
import ApiError from '../utils/ApiError';

interface TokenPayload {
  sub: string;
  iat: number;
  exp: number;
  type: TokenType;
}

export interface AuthTokens {
  access: {
    token: string;
    expires: Date;
  };
  refresh: {
    token: string;
    expires: Date;
  };
}

/**
 * Generate token
 * @param userId - User ID
 * @param expires - Token expiration
 * @param type - Token type
 * @param secret - JWT secret
 * @returns JWT token string
 */
const generateToken = (
  userId: string,
  expires: dayjs.Dayjs,
  type: TokenType,
  secret: string = config.jwt.secret
): string => {
  const payload: TokenPayload = {
    sub: userId,
    iat: dayjs().unix(),
    exp: expires.unix(),
    type,
  };
  return jwt.sign(payload, secret);
};

/**
 * Save a token
 * @param token - Token string
 * @param userId - User ID
 * @param expires - Token expiration
 * @param type - Token type
 * @param blacklisted - Whether token is blacklisted
 * @returns Promise<Token>
 */
const saveToken = async (
  token: string,
  userId: string,
  expires: dayjs.Dayjs,
  type: TokenType,
  blacklisted: boolean = false
): Promise<Token> => {
  const tokenDoc = await prisma.token.create({
    data: {
      token,
      userId,
      expires: expires.toDate(),
      type,
      blacklisted,
    },
  });
  return tokenDoc;
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param token - Token string
 * @param type - Token type
 * @returns Promise<Token>
 */
const verifyToken = async (token: string, type: TokenType): Promise<Token> => {
  const payload = jwt.verify(token, config.jwt.secret) as TokenPayload;
  const tokenDoc = await prisma.token.findFirst({
    where: {
      token,
      type,
      userId: payload.sub,
      blacklisted: false,
    },
  });
  if (!tokenDoc) {
    throw new Error('Token not found');
  }
  return tokenDoc;
};

/**
 * Generate auth tokens
 * @param user - User object
 * @returns Promise<AuthTokens>
 */
const generateAuthTokens = async (user: User): Promise<AuthTokens> => {
  const accessTokenExpires = dayjs().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(user.id, accessTokenExpires, TokenType.ACCESS);

  const refreshTokenExpires = dayjs().add(config.jwt.refreshExpirationDays, 'days');
  const refreshToken = generateToken(user.id, refreshTokenExpires, TokenType.REFRESH);
  await saveToken(refreshToken, user.id, refreshTokenExpires, TokenType.REFRESH);

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate(),
    },
  };
};

/**
 * Generate reset password token
 * @param email - User email
 * @returns Promise<string>
 */
const generateResetPasswordToken = async (email: string): Promise<string> => {
  const user = await userService.getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No users found with this email');
  }
  const expires = dayjs().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const resetPasswordToken = generateToken(user.id, expires, TokenType.RESET_PASSWORD);
  await saveToken(resetPasswordToken, user.id, expires, TokenType.RESET_PASSWORD);
  return resetPasswordToken;
};

/**
 * Generate verify email token
 * @param user - User object
 * @returns Promise<string>
 */
const generateVerifyEmailToken = async (user: User): Promise<string> => {
  const expires = dayjs().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
  const verifyEmailToken = generateToken(user.id, expires, TokenType.VERIFY_EMAIL);
  await saveToken(verifyEmailToken, user.id, expires, TokenType.VERIFY_EMAIL);
  return verifyEmailToken;
};

export default {
  generateToken,
  saveToken,
  verifyToken,
  generateAuthTokens,
  generateResetPasswordToken,
  generateVerifyEmailToken,
};
