import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test password (plain text for testing) - meets validation requirements
export const testPassword = 'Password123!';

// Pre-hashed password for consistent testing
const salt = bcrypt.genSaltSync(8);
const hashedTestPassword = bcrypt.hashSync(testPassword, salt);

// Test user fixtures
export const userOne = {
  name: 'User One',
  email: 'userone@example.com',
  password: testPassword,
  role: 'USER' as const,
  isEmailVerified: false,
};

export const userTwo = {
  name: 'User Two',
  email: 'usertwo@example.com',
  password: testPassword,
  role: 'USER' as const,
  isEmailVerified: true,
};

export const adminUser = {
  name: 'Admin User',
  email: 'admin@example.com',
  password: testPassword,
  role: 'ADMIN' as const,
  isEmailVerified: true,
};

// Helper function to insert users into the database
export const insertUsers = async (users: (typeof userOne)[]) => {
  const usersWithHashedPassword = users.map((user) => ({
    ...user,
    password: hashedTestPassword,
  }));

  const createdUsers = await Promise.all(
    usersWithHashedPassword.map((user) =>
      prisma.user.create({
        data: user,
      })
    )
  );

  return createdUsers;
};

// Helper function to get a user by email
export const getUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email },
  });
};

// Helper function to clean up users
export const cleanupUsers = async () => {
  await prisma.user.deleteMany();
};
