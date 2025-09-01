import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import { PrismaClient, TokenType } from '@prisma/client';
import tokenService from '../../../src/services/token.service';
import config from '../../../src/config/config';
import { userOne, insertUsers } from '../../fixtures/user.fixture';
import setupTestDB from '../../utils/setupTestDB';

setupTestDB();

const prisma = new PrismaClient();

describe('Token service', () => {
  describe('generateToken', () => {
    test('should generate a JWT token', () => {
      const userId = 'user-id';
      const expires = dayjs().add(1, 'hour');
      const type = TokenType.ACCESS;

      const token = tokenService.generateToken(userId, expires, type);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, config.jwt.secret) as any;
      expect(decoded.sub).toBe(userId);
      expect(decoded.type).toBe(type);
    });
  });

  describe('saveToken', () => {
    test('should save token to database', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const token = 'sample-token';
      const expires = dayjs().add(1, 'day');
      const type = TokenType.REFRESH;

      const savedToken = await tokenService.saveToken(token, insertedUser.id, expires, type);

      expect(savedToken).toMatchObject({
        token,
        userId: insertedUser.id,
        type,
        blacklisted: false,
      });
      expect(savedToken.expires.getTime()).toBeCloseTo(expires.toDate().getTime(), -1000);

      const dbToken = await prisma.token.findUnique({
        where: { id: savedToken.id },
      });
      expect(dbToken).toBeDefined();
    });

    test('should save token with blacklisted flag', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const token = 'blacklisted-token';
      const expires = dayjs().add(1, 'day');
      const type = TokenType.REFRESH;

      const savedToken = await tokenService.saveToken(token, insertedUser.id, expires, type, true);

      expect(savedToken.blacklisted).toBe(true);
    });
  });

  describe('verifyToken', () => {
    test('should verify and return token doc', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().add(1, 'hour');
      const token = tokenService.generateToken(insertedUser.id, expires, TokenType.ACCESS);

      await tokenService.saveToken(token, insertedUser.id, expires, TokenType.ACCESS);

      const tokenDoc = await tokenService.verifyToken(token, TokenType.ACCESS);

      expect(tokenDoc).toBeDefined();
      expect(tokenDoc.token).toBe(token);
      expect(tokenDoc.userId).toBe(insertedUser.id);
      expect(tokenDoc.type).toBe(TokenType.ACCESS);
    });

    test('should throw error if token is not found in database', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().add(1, 'hour');
      const token = tokenService.generateToken(insertedUser.id, expires, TokenType.ACCESS);

      await expect(tokenService.verifyToken(token, TokenType.ACCESS)).rejects.toThrow('Token not found');
    });

    test('should throw error if token is blacklisted', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().add(1, 'hour');
      const token = tokenService.generateToken(insertedUser.id, expires, TokenType.ACCESS);

      await tokenService.saveToken(token, insertedUser.id, expires, TokenType.ACCESS, true);

      await expect(tokenService.verifyToken(token, TokenType.ACCESS)).rejects.toThrow('Token not found');
    });

    test('should throw error if token is expired', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().subtract(1, 'minute');
      const token = tokenService.generateToken(insertedUser.id, expires, TokenType.ACCESS);

      await tokenService.saveToken(token, insertedUser.id, expires, TokenType.ACCESS);

      await expect(tokenService.verifyToken(token, TokenType.ACCESS)).rejects.toThrow();
    });

    test('should throw error if token type is wrong', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().add(1, 'hour');
      const token = tokenService.generateToken(insertedUser.id, expires, TokenType.ACCESS);

      await tokenService.saveToken(token, insertedUser.id, expires, TokenType.ACCESS);

      await expect(tokenService.verifyToken(token, TokenType.REFRESH)).rejects.toThrow('Token not found');
    });

    test('should throw error if token is signed with invalid secret', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().add(1, 'hour');
      const token = tokenService.generateToken(insertedUser.id, expires, TokenType.ACCESS, 'invalid-secret');

      await tokenService.saveToken(token, insertedUser.id, expires, TokenType.ACCESS);

      await expect(tokenService.verifyToken(token, TokenType.ACCESS)).rejects.toThrow();
    });
  });

  describe('generateAuthTokens', () => {
    test('should generate auth tokens', async () => {
      const [insertedUser] = await insertUsers([userOne]);

      const tokens = await tokenService.generateAuthTokens(insertedUser);

      expect(tokens).toHaveProperty('access');
      expect(tokens).toHaveProperty('refresh');
      expect(tokens.access).toHaveProperty('token');
      expect(tokens.access).toHaveProperty('expires');
      expect(tokens.refresh).toHaveProperty('token');
      expect(tokens.refresh).toHaveProperty('expires');

      // Verify access token
      const accessTokenDecoded = jwt.verify(tokens.access.token, config.jwt.secret) as any;
      expect(accessTokenDecoded.sub).toBe(insertedUser.id);
      expect(accessTokenDecoded.type).toBe(TokenType.ACCESS);

      // Verify refresh token is saved in database
      const refreshTokenDoc = await prisma.token.findFirst({
        where: { token: tokens.refresh.token },
      });
      expect(refreshTokenDoc).toBeDefined();
      expect(refreshTokenDoc?.type).toBe(TokenType.REFRESH);
    });
  });

  describe('generateResetPasswordToken', () => {
    test('should generate reset password token', async () => {
      const [insertedUser] = await insertUsers([userOne]);

      const resetPasswordToken = await tokenService.generateResetPasswordToken(insertedUser.email);

      expect(typeof resetPasswordToken).toBe('string');

      // Verify token is saved in database
      const tokenDoc = await prisma.token.findFirst({
        where: { token: resetPasswordToken },
      });
      expect(tokenDoc).toBeDefined();
      expect(tokenDoc?.type).toBe(TokenType.RESET_PASSWORD);
      expect(tokenDoc?.userId).toBe(insertedUser.id);
    });

    test('should throw error if user email does not exist', async () => {
      await expect(tokenService.generateResetPasswordToken('nonexistent@example.com')).rejects.toThrow(
        'No users found with this email'
      );
    });
  });

  describe('generateVerifyEmailToken', () => {
    test('should generate verify email token', async () => {
      const [insertedUser] = await insertUsers([userOne]);

      const verifyEmailToken = await tokenService.generateVerifyEmailToken(insertedUser);

      expect(typeof verifyEmailToken).toBe('string');

      // Verify token is saved in database
      const tokenDoc = await prisma.token.findFirst({
        where: { token: verifyEmailToken },
      });
      expect(tokenDoc).toBeDefined();
      expect(tokenDoc?.type).toBe(TokenType.VERIFY_EMAIL);
      expect(tokenDoc?.userId).toBe(insertedUser.id);
    });
  });
});
