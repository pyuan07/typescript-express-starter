import httpStatus from 'http-status';
import { User, TokenType } from '@prisma/client';
import tokenService, { AuthTokens } from './token.service';
import userService from './user.service';
import prisma from '../config/database';
import ApiError from '../utils/ApiError';

/**
 * Login with username and password
 * @param email - User email
 * @param password - User password
 * @returns Promise<User>
 */
const loginUserWithEmailAndPassword = async (email: string, password: string): Promise<User> => {
  const user = await userService.getUserByEmailWithPassword(email);
  if (!user || !(await userService.isPasswordMatch(user, password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  // Return user without password for security
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword as User;
};

/**
 * Logout
 * @param refreshToken - Refresh token
 * @returns Promise<void>
 */
const logout = async (refreshToken: string): Promise<void> => {
  const refreshTokenDoc = await prisma.token.findFirst({
    where: {
      token: refreshToken,
      type: TokenType.REFRESH,
      blacklisted: false,
    },
  });

  if (!refreshTokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }

  await prisma.token.delete({
    where: { id: refreshTokenDoc.id },
  });
};

/**
 * Refresh auth tokens
 * @param refreshToken - Refresh token
 * @returns Promise<AuthTokens>
 */
const refreshAuth = async (refreshToken: string): Promise<AuthTokens> => {
  try {
    const refreshTokenDoc = await tokenService.verifyToken(refreshToken, TokenType.REFRESH);
    const user = await userService.getUserById(refreshTokenDoc.userId);
    if (!user) {
      throw new Error();
    }

    await prisma.token.delete({
      where: { id: refreshTokenDoc.id },
    });

    return tokenService.generateAuthTokens(user);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

/**
 * Reset password
 * @param resetPasswordToken - Reset password token
 * @param newPassword - New password
 * @returns Promise<void>
 */
const resetPassword = async (resetPasswordToken: string, newPassword: string): Promise<void> => {
  try {
    const resetPasswordTokenDoc = await tokenService.verifyToken(resetPasswordToken, TokenType.RESET_PASSWORD);
    const user = await userService.getUserById(resetPasswordTokenDoc.userId);
    if (!user) {
      throw new Error();
    }

    await userService.updateUserById(user.id, { password: newPassword });
    await prisma.token.deleteMany({
      where: {
        userId: user.id,
        type: TokenType.RESET_PASSWORD,
      },
    });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed');
  }
};

/**
 * Verify email
 * @param verifyEmailToken - Email verification token
 * @returns Promise<void>
 */
const verifyEmail = async (verifyEmailToken: string): Promise<void> => {
  try {
    const verifyEmailTokenDoc = await tokenService.verifyToken(verifyEmailToken, TokenType.VERIFY_EMAIL);
    const user = await userService.getUserById(verifyEmailTokenDoc.userId);
    if (!user) {
      throw new Error();
    }

    await prisma.token.deleteMany({
      where: {
        userId: user.id,
        type: TokenType.VERIFY_EMAIL,
      },
    });

    await userService.updateUserById(user.id, { isEmailVerified: true });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed');
  }
};

export default {
  loginUserWithEmailAndPassword,
  logout,
  refreshAuth,
  resetPassword,
  verifyEmail,
};
