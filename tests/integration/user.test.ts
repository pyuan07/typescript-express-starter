import request from 'supertest';
import httpStatus from 'http-status';
import { PrismaClient } from '@prisma/client';
import app from '../../src/app';
import { userOne, userTwo, adminUser, insertUsers } from '../fixtures/user.fixture';
import { generateAuthTokens } from '../fixtures/token.fixture';
import setupTestDB from '../utils/setupTestDB';

setupTestDB();

const prisma = new PrismaClient();

describe('User routes', () => {
  describe('POST /v1/users', () => {
    let adminAccessToken: string;

    beforeEach(async () => {
      const [admin] = await insertUsers([adminUser]);
      const tokens = await generateAuthTokens(admin.id);
      adminAccessToken = tokens.access.token;
    });

    test('should return 201 and successfully create user if data is ok', async () => {
      const newUser = {
        name: userOne.name,
        email: userOne.email,
        password: 'Password123!',
        role: 'USER',
      };

      const res = await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newUser)
        .expect(httpStatus.CREATED);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: expect.anything(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isEmailVerified: false,
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      });

      const dbUser = await prisma.user.findUnique({ where: { id: res.body.id } });
      expect(dbUser).toBeDefined();
      expect(dbUser?.password).not.toBe(newUser.password);
    });

    test('should return 400 error if email is invalid', async () => {
      const newUser = { ...userOne, email: 'invalidEmail' };

      await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newUser)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if email is already used', async () => {
      await insertUsers([userOne]);
      const newUser = { name: 'John Doe', email: userOne.email, password: 'Password123!', role: 'USER' };

      await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newUser)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 error if access token is missing', async () => {
      const newUser = { ...userOne, password: 'Password123!' };

      await request(app).post('/v1/users').send(newUser).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      const [normalUser] = await insertUsers([userOne]);
      const userTokens = await generateAuthTokens(normalUser.id);
      const newUser = { name: 'John Doe', email: 'john@example.com', password: 'Password123!', role: 'USER' };

      await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${userTokens.access.token}`)
        .send(newUser)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /v1/users', () => {
    let adminAccessToken: string;

    beforeEach(async () => {
      const [admin] = await insertUsers([adminUser]);
      const tokens = await generateAuthTokens(admin.id);
      adminAccessToken = tokens.access.token;
    });

    test('should return 200 and apply the default query options', async () => {
      await insertUsers([userOne, userTwo]);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: expect.any(Number),
        totalResults: expect.any(Number),
      });
      expect(res.body.results).toHaveLength(3); // Including admin user
      expect(res.body.results[0]).toEqual({
        id: expect.anything(),
        name: expect.anything(),
        email: expect.anything(),
        role: expect.anything(),
        isEmailVerified: expect.anything(),
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      });
    });

    test('should correctly apply filter on name field', async () => {
      await insertUsers([userOne, userTwo]);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ name: userOne.name })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: expect.any(Number),
        totalResults: expect.any(Number),
      });
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].id).toBeDefined();
    });

    test('should correctly sort the returned array if descending sort param is specified', async () => {
      await insertUsers([userOne, userTwo]);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ sortBy: 'role:desc' })
        .send()
        .expect(httpStatus.OK);

      expect(res.body.results[0].role).toBe('USER');
    });

    test('should correctly sort the returned array if ascending sort param is specified', async () => {
      await insertUsers([userOne, userTwo]);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ sortBy: 'role:asc' })
        .send()
        .expect(httpStatus.OK);

      expect(res.body.results[0].role).toBe('ADMIN');
    });

    test('should limit returned array if limit param is specified', async () => {
      await insertUsers([userOne, userTwo]);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ limit: 2 })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 2,
        totalPages: expect.any(Number),
        totalResults: expect.any(Number),
      });
      expect(res.body.results).toHaveLength(2);
    });

    test('should return 401 if access token is missing', async () => {
      await request(app).get('/v1/users').send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 if user is not admin', async () => {
      const [normalUser] = await insertUsers([userOne]);
      const userTokens = await generateAuthTokens(normalUser.id);

      await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${userTokens.access.token}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /v1/users/:userId', () => {
    let adminAccessToken: string;

    beforeEach(async () => {
      const [admin] = await insertUsers([adminUser]);
      const tokens = await generateAuthTokens(admin.id);
      adminAccessToken = tokens.access.token;
    });

    test('should return 200 and the user object if data is ok', async () => {
      const [insertedUser] = await insertUsers([userOne]);

      const res = await request(app)
        .get(`/v1/users/${insertedUser.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: insertedUser.id,
        email: userOne.email,
        name: userOne.name,
        role: userOne.role,
        isEmailVerified: userOne.isEmailVerified,
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      });
    });

    test('should return 401 error if access token is missing', async () => {
      const [insertedUser] = await insertUsers([userOne]);

      await request(app).get(`/v1/users/${insertedUser.id}`).send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is trying to get another user', async () => {
      const [user1, user2] = await insertUsers([userOne, userTwo]);
      const user1Tokens = await generateAuthTokens(user1.id);

      await request(app)
        .get(`/v1/users/${user2.id}`)
        .set('Authorization', `Bearer ${user1Tokens.access.token}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 200 and the user object if user is trying to get their own information', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const userTokens = await generateAuthTokens(insertedUser.id);

      const res = await request(app)
        .get(`/v1/users/${insertedUser.id}`)
        .set('Authorization', `Bearer ${userTokens.access.token}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: insertedUser.id,
        email: userOne.email,
        name: userOne.name,
        role: userOne.role,
        isEmailVerified: userOne.isEmailVerified,
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      });
    });

    test('should return 400 error if userId is not a valid uuid', async () => {
      await request(app)
        .get('/v1/users/invalidId')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error if user is not found', async () => {
      await request(app)
        .get('/v1/users/9c6e8c68-7b9a-4a3a-9b3a-8c7d9e0f1a2b')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('PATCH /v1/users/:userId', () => {
    let adminAccessToken: string;

    beforeEach(async () => {
      const [admin] = await insertUsers([adminUser]);
      const tokens = await generateAuthTokens(admin.id);
      adminAccessToken = tokens.access.token;
    });

    test('should return 200 and successfully update user if data is ok', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const updateBody = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const res = await request(app)
        .patch(`/v1/users/${insertedUser.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: insertedUser.id,
        name: updateBody.name,
        email: updateBody.email,
        role: userOne.role,
        isEmailVerified: userOne.isEmailVerified,
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      });

      const dbUser = await prisma.user.findUnique({ where: { id: insertedUser.id } });
      expect(dbUser).toMatchObject({
        name: updateBody.name,
        email: updateBody.email,
        role: userOne.role,
        isEmailVerified: userOne.isEmailVerified,
      });
    });

    test('should return 401 error if access token is missing', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const updateBody = { name: 'Updated Name' };

      await request(app).patch(`/v1/users/${insertedUser.id}`).send(updateBody).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 if user is updating another user', async () => {
      const [user1, user2] = await insertUsers([userOne, userTwo]);
      const user1Tokens = await generateAuthTokens(user1.id);
      const updateBody = { name: 'Updated Name' };

      await request(app)
        .patch(`/v1/users/${user2.id}`)
        .set('Authorization', `Bearer ${user1Tokens.access.token}`)
        .send(updateBody)
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 200 and successfully update user if user is updating their own information', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const userTokens = await generateAuthTokens(insertedUser.id);
      const updateBody = { name: 'Updated Name' };

      const res = await request(app)
        .patch(`/v1/users/${insertedUser.id}`)
        .set('Authorization', `Bearer ${userTokens.access.token}`)
        .send(updateBody)
        .expect(httpStatus.OK);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: insertedUser.id,
        name: updateBody.name,
        email: userOne.email,
        role: userOne.role,
        isEmailVerified: userOne.isEmailVerified,
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      });
    });

    test('should return 404 if admin is updating another user that is not found', async () => {
      const updateBody = { name: 'Updated Name' };

      await request(app)
        .patch('/v1/users/9c6e8c68-7b9a-4a3a-9b3a-8c7d9e0f1a2b')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 400 error if userId is not a valid uuid', async () => {
      const updateBody = { name: 'Updated Name' };

      await request(app)
        .patch('/v1/users/invalidId')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if email is invalid', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const updateBody = { email: 'invalidEmail' };

      await request(app)
        .patch(`/v1/users/${insertedUser.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if email is already taken', async () => {
      const [user1, user2] = await insertUsers([userOne, userTwo]);
      const updateBody = { email: user2.email };

      await request(app)
        .patch(`/v1/users/${user1.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('DELETE /v1/users/:userId', () => {
    let adminAccessToken: string;

    beforeEach(async () => {
      const [admin] = await insertUsers([adminUser]);
      const tokens = await generateAuthTokens(admin.id);
      adminAccessToken = tokens.access.token;
    });

    test('should return 204 if data is ok', async () => {
      const [insertedUser] = await insertUsers([userOne]);

      await request(app)
        .delete(`/v1/users/${insertedUser.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbUser = await prisma.user.findUnique({ where: { id: insertedUser.id } });
      expect(dbUser).toBeNull();
    });

    test('should return 401 error if access token is missing', async () => {
      const [insertedUser] = await insertUsers([userOne]);

      await request(app).delete(`/v1/users/${insertedUser.id}`).send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is trying to delete another user', async () => {
      const [user1, user2] = await insertUsers([userOne, userTwo]);
      const user1Tokens = await generateAuthTokens(user1.id);

      await request(app)
        .delete(`/v1/users/${user2.id}`)
        .set('Authorization', `Bearer ${user1Tokens.access.token}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 204 if user is trying to delete themselves', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const userTokens = await generateAuthTokens(insertedUser.id);

      await request(app)
        .delete(`/v1/users/${insertedUser.id}`)
        .set('Authorization', `Bearer ${userTokens.access.token}`)
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbUser = await prisma.user.findUnique({ where: { id: insertedUser.id } });
      expect(dbUser).toBeNull();
    });

    test('should return 400 error if userId is not a valid uuid', async () => {
      await request(app)
        .delete('/v1/users/invalidId')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error if user is not found', async () => {
      await request(app)
        .delete('/v1/users/9c6e8c68-7b9a-4a3a-9b3a-8c7d9e0f1a2b')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.NOT_FOUND);
    });
  });
});
