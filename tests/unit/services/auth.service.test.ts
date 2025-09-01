import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { PrismaClient, TokenType } from '@prisma/client';
import authService from '../../../src/services/auth.service';
import tokenService from '../../../src/services/token.service';
import { userOne, testPassword, insertUsers } from '../../fixtures/user.fixture';
import setupTestDB from '../../utils/setupTestDB';

setupTestDB();

const prisma = new PrismaClient();

describe('Auth service', () => {
  describe('loginUserWithEmailAndPassword', () => {
    test('should return user if email and password match', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const user = await authService.loginUserWithEmailAndPassword(userOne.email, testPassword);

      expect(user).toBeDefined();
      expect(user.id).toBe(insertedUser.id);
      expect(user.email).toBe(userOne.email);
    });

    test('should throw error if email does not exist', async () => {
      await expect(authService.loginUserWithEmailAndPassword('nonexistent@example.com', testPassword)).rejects.toThrow(
        'Incorrect email or password'
      );
    });

    test('should throw error if password is wrong', async () => {
      await insertUsers([userOne]);

      await expect(authService.loginUserWithEmailAndPassword(userOne.email, 'wrongpassword')).rejects.toThrow(
        'Incorrect email or password'
      );
    });
  });

  describe('logout', () => {
    test('should remove refresh token from database', async () => {
      const [insertedUser] = await insertUsers([userOne]);

      // Create a refresh token
      const refreshToken = await prisma.token.create({
        data: {
          token: 'sample-refresh-token',
          userId: insertedUser.id,
          type: 'REFRESH',
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          blacklisted: false,
        },
      });

      await authService.logout('sample-refresh-token');

      const tokenInDb = await prisma.token.findUnique({
        where: { id: refreshToken.id },
      });
      expect(tokenInDb).toBeNull();
    });

    test('should throw error if refresh token is not found', async () => {
      await expect(authService.logout('nonexistent-token')).rejects.toThrow('Not found');
    });
  });

  describe('refreshAuth', () => {
    test('should generate new tokens and remove old refresh token', async () => {
      const [insertedUser] = await insertUsers([userOne]);

      // Create a valid refresh token
      const refreshTokenExpires = dayjs().add(7, 'days');
      const refreshTokenJWT = tokenService.generateToken(insertedUser.id, refreshTokenExpires, TokenType.REFRESH);

      const oldRefreshToken = await prisma.token.create({
        data: {
          token: refreshTokenJWT,
          userId: insertedUser.id,
          type: TokenType.REFRESH,
          expires: refreshTokenExpires.toDate(),
          blacklisted: false,
        },
      });

      const result = await authService.refreshAuth(refreshTokenJWT);

      expect(result).toHaveProperty('access');
      expect(result).toHaveProperty('refresh');
      expect(result.access).toHaveProperty('token');
      expect(result.refresh).toHaveProperty('token');

      // Old refresh token should be removed
      const oldTokenInDb = await prisma.token.findUnique({
        where: { id: oldRefreshToken.id },
      });
      expect(oldTokenInDb).toBeNull();

      // New refresh token should exist
      const newTokenInDb = await prisma.token.findFirst({
        where: { token: result.refresh.token },
      });
      expect(newTokenInDb).toBeDefined();
    });

    test('should throw error if refresh token is invalid', async () => {
      await expect(authService.refreshAuth('invalid-token')).rejects.toThrow('Please authenticate');
    });

    test('should throw error if refresh token is blacklisted', async () => {
      const [insertedUser] = await insertUsers([userOne]);

      await prisma.token.create({
        data: {
          token: 'blacklisted-token',
          userId: insertedUser.id,
          type: 'REFRESH',
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          blacklisted: true,
        },
      });

      await expect(authService.refreshAuth('blacklisted-token')).rejects.toThrow('Please authenticate');
    });
  });

  describe('resetPassword', () => {
    test('should reset password when reset token is valid', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const newPassword = 'newpassword123';

      // Create a valid reset token
      const resetTokenExpires = dayjs().add(10, 'minutes');
      const resetTokenJWT = tokenService.generateToken(insertedUser.id, resetTokenExpires, TokenType.RESET_PASSWORD);

      await prisma.token.create({
        data: {
          token: resetTokenJWT,
          userId: insertedUser.id,
          type: TokenType.RESET_PASSWORD,
          expires: resetTokenExpires.toDate(),
          blacklisted: false,
        },
      });

      await authService.resetPassword(resetTokenJWT, newPassword);

      // Check if password was updated
      const updatedUser = await prisma.user.findUnique({
        where: { id: insertedUser.id },
      });

      expect(updatedUser).toBeDefined();
      expect(await bcrypt.compare(newPassword, updatedUser!.password)).toBe(true);

      // Reset token should be removed
      const tokenInDb = await prisma.token.findFirst({
        where: { token: resetTokenJWT },
      });
      expect(tokenInDb).toBeNull();
    });

    test('should throw error if reset token is invalid', async () => {
      await expect(authService.resetPassword('invalid-token', 'newpassword123')).rejects.toThrow('Password reset failed');
    });
  });

  describe('verifyEmail', () => {
    test('should verify email when verification token is valid', async () => {
      const userToInsert = { ...userOne, isEmailVerified: false };
      const [insertedUser] = await insertUsers([userToInsert]);

      // Create a valid verification token
      const verifyTokenExpires = dayjs().add(10, 'minutes');
      const verifyTokenJWT = tokenService.generateToken(insertedUser.id, verifyTokenExpires, TokenType.VERIFY_EMAIL);

      await prisma.token.create({
        data: {
          token: verifyTokenJWT,
          userId: insertedUser.id,
          type: TokenType.VERIFY_EMAIL,
          expires: verifyTokenExpires.toDate(),
          blacklisted: false,
        },
      });

      await authService.verifyEmail(verifyTokenJWT);

      // Check if email was verified
      const updatedUser = await prisma.user.findUnique({
        where: { id: insertedUser.id },
      });

      expect(updatedUser?.isEmailVerified).toBe(true);

      // Verification token should be removed
      const tokenInDb = await prisma.token.findFirst({
        where: { token: verifyTokenJWT },
      });
      expect(tokenInDb).toBeNull();
    });

    test('should throw error if verification token is invalid', async () => {
      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow('Email verification failed');
    });
  });
});
