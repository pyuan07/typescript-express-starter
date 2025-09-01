import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import config from '../../src/config/config';
import { TokenType } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import tokenService from '../../src/services/token.service';

const prisma = new PrismaClient();

// Generate JWT token
export const generateToken = (
  userId: string,
  expires: dayjs.Dayjs,
  type: TokenType = TokenType.ACCESS,
  secret = config.jwt.secret
) => {
  const payload = {
    sub: userId,
    iat: dayjs().unix(),
    exp: expires.unix(),
    type,
  };
  return jwt.sign(payload, secret);
};

// Generate auth tokens (access + refresh) - use the service
export const generateAuthTokens = async (userId: string) => {
  // First get the user to pass to the service
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  return await tokenService.generateAuthTokens(user);
};

// Helper function to save a token to the database
export const saveToken = async (
  token: string,
  userId: string,
  expires: dayjs.Dayjs,
  type: TokenType,
  blacklisted = false
) => {
  return await prisma.token.create({
    data: {
      token,
      userId,
      type,
      expires: expires.toDate(),
      blacklisted,
    },
  });
};
