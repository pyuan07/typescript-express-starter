import { PrismaClient } from '@prisma/client';
import userService from '../../../src/services/user.service';
import { userOne, userTwo, insertUsers } from '../../fixtures/user.fixture';
import setupTestDB from '../../utils/setupTestDB';
import { NONEXISTENT_ID, INVALID_UUID } from '../../utils/testConstants';

setupTestDB();

const prisma = new PrismaClient();

describe('User service', () => {
  describe('createUser', () => {
    test('should create a user', async () => {
      const user = await userService.createUser(userOne);

      expect(user).toMatchObject({
        name: userOne.name,
        email: userOne.email,
        role: userOne.role,
        isEmailVerified: userOne.isEmailVerified,
      });

      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('createdAt');
      expect(user).toHaveProperty('updatedAt');

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(dbUser).toBeDefined();
    });

    test('should throw error if email format is invalid', async () => {
      const invalidUser = { ...userOne, email: 'invalid-email' };
      await expect(userService.createUser(invalidUser)).rejects.toThrow('Invalid email format');
    });

    test('should throw error if email is already taken', async () => {
      await insertUsers([userOne]);
      await expect(userService.createUser(userOne)).rejects.toThrow('Email already taken');
    });

    test('should hash the password', async () => {
      const user = await userService.createUser(userOne);

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      expect(dbUser?.password).not.toBe(userOne.password);
      expect(dbUser?.password).toHaveLength(60); // bcrypt hash length
    });
  });

  describe('queryUsers', () => {
    test('should return users with pagination', async () => {
      await insertUsers([userOne, userTwo]);

      const result = await userService.queryUsers({}, { page: 1, limit: 10, sortBy: 'createdAt' });

      expect(result.results).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.totalResults).toBe(2);
    });

    test('should return filtered users', async () => {
      await insertUsers([userOne, userTwo]);

      const result = await userService.queryUsers({ name: userOne.name }, { page: 1, limit: 10, sortBy: 'createdAt' });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].name).toBe(userOne.name);
    });

    test('should sort users', async () => {
      await insertUsers([userOne, userTwo]);

      const result = await userService.queryUsers({}, { page: 1, limit: 10, sortBy: 'name:asc' });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].name).toBe(userOne.name); // Assuming userOne.name comes first alphabetically
    });

    test('should paginate users', async () => {
      await insertUsers([userOne, userTwo]);

      const result = await userService.queryUsers({}, { page: 1, limit: 1, sortBy: 'createdAt' });

      expect(result.results).toHaveLength(1);
      expect(result.totalPages).toBe(2);
      expect(result.totalResults).toBe(2);
    });
  });

  describe('getUserById', () => {
    test('should return user if found', async () => {
      const [insertedUser] = await insertUsers([userOne]);

      const user = await userService.getUserById(insertedUser.id);

      expect(user).toMatchObject({
        id: insertedUser.id,
        name: userOne.name,
        email: userOne.email,
        role: userOne.role,
      });
    });

    test('should throw error if user ID format is invalid', async () => {
      await expect(userService.getUserById(INVALID_UUID)).rejects.toThrow('Invalid user ID format');
    });

    test('should return null if user not found', async () => {
      const user = await userService.getUserById(NONEXISTENT_ID);
      expect(user).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    test('should return user if found', async () => {
      await insertUsers([userOne]);

      const user = await userService.getUserByEmail(userOne.email);

      expect(user).toMatchObject({
        name: userOne.name,
        email: userOne.email,
        role: userOne.role,
      });
    });

    test('should return null if user not found', async () => {
      const user = await userService.getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('updateUserById', () => {
    test('should update user', async () => {
      const [insertedUser] = await insertUsers([userOne]);
      const updateBody = { name: 'Updated Name', email: 'updated@example.com' };

      const updatedUser = await userService.updateUserById(insertedUser.id, updateBody);

      expect(updatedUser).toMatchObject({
        id: insertedUser.id,
        name: updateBody.name,
        email: updateBody.email,
      });

      const dbUser = await prisma.user.findUnique({
        where: { id: insertedUser.id },
      });
      expect(dbUser).toMatchObject(updateBody);
    });

    test('should throw error if user ID format is invalid', async () => {
      const updateBody = { name: 'Updated Name' };
      await expect(userService.updateUserById(INVALID_UUID, updateBody)).rejects.toThrow('Invalid user ID format');
    });

    test('should throw error if user not found', async () => {
      const updateBody = { name: 'Updated Name' };
      await expect(userService.updateUserById(NONEXISTENT_ID, updateBody)).rejects.toThrow('User not found');
    });

    test('should throw error if email format is invalid', async () => {
      const [user] = await insertUsers([userOne]);
      const updateBody = { email: 'invalid-email' };
      await expect(userService.updateUserById(user.id, updateBody)).rejects.toThrow('Invalid email format');
    });

    test('should throw error if email is already taken', async () => {
      const [user1, user2] = await insertUsers([userOne, userTwo]);
      const updateBody = { email: user2.email };
      await expect(userService.updateUserById(user1.id, updateBody)).rejects.toThrow('Email already taken');
    });
  });

  describe('deleteUserById', () => {
    test('should delete user', async () => {
      const [insertedUser] = await insertUsers([userOne]);

      await userService.deleteUserById(insertedUser.id);

      const dbUser = await prisma.user.findUnique({
        where: { id: insertedUser.id },
      });
      expect(dbUser).toBeNull();
    });

    test('should throw error if user ID format is invalid', async () => {
      await expect(userService.deleteUserById(INVALID_UUID)).rejects.toThrow('Invalid user ID format');
    });

    test('should throw error if user not found', async () => {
      await expect(userService.deleteUserById(NONEXISTENT_ID)).rejects.toThrow('User not found');
    });
  });
});
