import request from 'supertest';
import dayjs from 'dayjs';
import httpStatus from 'http-status';
import { PrismaClient, TokenType } from '@prisma/client';
import app from '../../src/app';
import config from '../../src/config/config';
import tokenService from '../../src/services/token.service';
import { userOne, adminUser, testPassword, insertUsers } from '../fixtures/user.fixture';
import { generateAuthTokens } from '../fixtures/token.fixture';
import setupTestDB from '../utils/setupTestDB';

setupTestDB();

const prisma = new PrismaClient();

describe('Auth routes', () => {
  describe('POST /v1/auth/register', () => {
    test('should return 201 and successfully register user if request data is ok', async () => {
      const newUser = {
        name: userOne.name,
        email: userOne.email,
        password: testPassword,
      };

      const res = await request(app).post('/v1/auth/register').send(newUser).expect(httpStatus.CREATED);

      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.user).toEqual({
        id: expect.anything(),
        name: newUser.name,
        email: newUser.email,
        role: 'USER',
        isEmailVerified: false,
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      });

      const dbUser = await prisma.user.findUnique({ where: { id: res.body.user.id } });
      expect(dbUser).toBeDefined();
      expect(dbUser?.password).not.toBe(newUser.password);
      expect(dbUser).toMatchObject({
        name: newUser.name,
        email: newUser.email,
        role: 'USER',
        isEmailVerified: false,
      });

      expect(res.body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });
    });

    test('should return 400 error if email is invalid', async () => {
      const newUser = { ...userOne, email: 'invalidEmail' };
      await request(app).post('/v1/auth/register').send(newUser).expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if email is already used', async () => {
      await insertUsers([userOne]);
      const newUser = { name: 'John Doe', email: userOne.email, password: testPassword };
      await request(app).post('/v1/auth/register').send(newUser).expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password length is less than 8 characters', async () => {
      const newUser = { ...userOne, password: 'short1' };
      await request(app).post('/v1/auth/register').send(newUser).expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password does not contain both letters and numbers', async () => {
      const newUser = { ...userOne, password: 'password' };
      await request(app).post('/v1/auth/register').send(newUser).expect(httpStatus.BAD_REQUEST);

      newUser.password = '11111111';
      await request(app).post('/v1/auth/register').send(newUser).expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/auth/login', () => {
    test('should return 200 and login user if email and password match', async () => {
      await insertUsers([userOne]);
      const loginCredentials = {
        email: userOne.email,
        password: testPassword,
      };

      const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.OK);

      expect(res.body.user).toEqual({
        id: expect.anything(),
        name: userOne.name,
        email: userOne.email,
        role: userOne.role,
        isEmailVerified: userOne.isEmailVerified,
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      });

      expect(res.body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });
    });

    test('should return 401 error if there are no users with that email', async () => {
      const loginCredentials = {
        email: userOne.email,
        password: testPassword,
      };

      const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.UNAUTHORIZED);
      expect(res.body).toEqual({ code: httpStatus.UNAUTHORIZED, message: 'Incorrect email or password' });
    });

    test('should return 401 error if password is wrong', async () => {
      await insertUsers([userOne]);
      const loginCredentials = {
        email: userOne.email,
        password: 'wrongPassword1',
      };

      const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.UNAUTHORIZED);
      expect(res.body).toEqual({ code: httpStatus.UNAUTHORIZED, message: 'Incorrect email or password' });
    });
  });

  describe('POST /v1/auth/logout', () => {
    test('should return 204 if refresh token is valid', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(insertedUser.id, expires, TokenType.REFRESH);
      await tokenService.saveToken(refreshToken, insertedUser.id, expires, TokenType.REFRESH);

      await request(app).post('/v1/auth/logout').send({ refreshToken }).expect(httpStatus.NO_CONTENT);

      const dbRefreshTokenDoc = await prisma.token.findFirst({ where: { token: refreshToken } });
      expect(dbRefreshTokenDoc).toBe(null);
    });

    test('should return 400 error if refresh token is missing from request body', async () => {
      await request(app).post('/v1/auth/logout').send().expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error if refresh token is not found in the database', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(insertedUser.id, expires, TokenType.REFRESH);

      await request(app).post('/v1/auth/logout').send({ refreshToken }).expect(httpStatus.NOT_FOUND);
    });
  });

  describe('POST /v1/auth/refresh-tokens', () => {
    test('should return 200 and new auth tokens if refresh token is valid', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(insertedUser.id, expires, TokenType.REFRESH);
      await tokenService.saveToken(refreshToken, insertedUser.id, expires, TokenType.REFRESH);

      const res = await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.OK);

      expect(res.body).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });

      const dbRefreshTokenDoc = await prisma.token.findFirst({ where: { token: res.body.refresh.token } });
      expect(dbRefreshTokenDoc).toMatchObject({
        type: TokenType.REFRESH,
        userId: insertedUser.id,
        blacklisted: false,
      });

      const dbRefreshTokenCount = await prisma.token.count();
      expect(dbRefreshTokenCount).toBe(1);
    });

    test('should return 400 error if refresh token is missing from request body', async () => {
      await request(app).post('/v1/auth/refresh-tokens').send().expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 error if refresh token is not found in the database', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(insertedUser.id, expires, TokenType.REFRESH);

      await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is expired', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().subtract(1, 'minutes');
      const refreshToken = tokenService.generateToken(insertedUser.id, expires, TokenType.REFRESH);
      await tokenService.saveToken(refreshToken, insertedUser.id, expires, TokenType.REFRESH);

      await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/auth/forgot-password', () => {
    test('should return 204 and send reset password email to the user', async () => {
      await insertUsers([userOne]);

      await request(app).post('/v1/auth/forgot-password').send({ email: userOne.email }).expect(httpStatus.NO_CONTENT);

      const dbResetPasswordTokenDoc = await prisma.token.findFirst({
        where: {
          userId: (await prisma.user.findFirst({ where: { email: userOne.email } }))?.id,
          type: TokenType.RESET_PASSWORD,
        },
      });
      expect(dbResetPasswordTokenDoc).toBeDefined();
    });

    test('should return 400 if email is missing', async () => {
      await insertUsers([userOne]);
      await request(app).post('/v1/auth/forgot-password').send().expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 if email does not belong to any user', async () => {
      await request(app).post('/v1/auth/forgot-password').send({ email: userOne.email }).expect(httpStatus.NOT_FOUND);
    });
  });

  describe('POST /v1/auth/reset-password', () => {
    test('should return 204 and reset the password', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(insertedUser.id, expires, TokenType.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, insertedUser.id, expires, TokenType.RESET_PASSWORD);

      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: 'password2' })
        .expect(httpStatus.NO_CONTENT);

      const dbUser = await prisma.user.findUnique({ where: { id: insertedUser.id } });
      expect(dbUser).toBeDefined();

      const dbResetPasswordTokenCount = await prisma.token.count({
        where: { userId: insertedUser.id, type: TokenType.RESET_PASSWORD },
      });
      expect(dbResetPasswordTokenCount).toBe(0);
    });

    test('should return 400 if reset password token is missing', async () => {
      await insertUsers([userOne]);
      await request(app).post('/v1/auth/reset-password').send({ password: 'password2' }).expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if reset password token is expired', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().subtract(1, 'minutes');
      const resetPasswordToken = tokenService.generateToken(insertedUser.id, expires, TokenType.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, insertedUser.id, expires, TokenType.RESET_PASSWORD);

      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: 'password2' })
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/auth/send-verification-email', () => {
    test('should return 204 and send verification email to the user', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const userTokens = await generateAuthTokens(insertedUser.id);

      await request(app)
        .post('/v1/auth/send-verification-email')
        .set('Authorization', `Bearer ${userTokens.access.token}`)
        .expect(httpStatus.NO_CONTENT);

      const dbVerifyEmailToken = await prisma.token.findFirst({
        where: { userId: insertedUser.id, type: TokenType.VERIFY_EMAIL },
      });
      expect(dbVerifyEmailToken).toBeDefined();
    });

    test('should return 401 error if access token is missing', async () => {
      await insertUsers([userOne]);
      await request(app).post('/v1/auth/send-verification-email').send().expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/auth/verify-email', () => {
    test('should return 204 and verify the email', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
      const verifyEmailToken = tokenService.generateToken(insertedUser.id, expires, TokenType.VERIFY_EMAIL);
      await tokenService.saveToken(verifyEmailToken, insertedUser.id, expires, TokenType.VERIFY_EMAIL);

      await request(app)
        .post('/v1/auth/verify-email')
        .query({ token: verifyEmailToken })
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbUser = await prisma.user.findUnique({ where: { id: insertedUser.id } });
      expect(dbUser?.isEmailVerified).toBe(true);

      const dbVerifyEmailToken = await prisma.token.count({
        where: { userId: insertedUser.id, type: TokenType.VERIFY_EMAIL },
      });
      expect(dbVerifyEmailToken).toBe(0);
    });

    test('should return 400 if verify email token is missing', async () => {
      await insertUsers([userOne]);
      await request(app).post('/v1/auth/verify-email').send().expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if verify email token is expired', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const expires = dayjs().subtract(1, 'minutes');
      const verifyEmailToken = tokenService.generateToken(insertedUser.id, expires, TokenType.VERIFY_EMAIL);
      await tokenService.saveToken(verifyEmailToken, insertedUser.id, expires, TokenType.VERIFY_EMAIL);

      await request(app)
        .post('/v1/auth/verify-email')
        .query({ token: verifyEmailToken })
        .send()
        .expect(httpStatus.UNAUTHORIZED);
    });
  });
});
