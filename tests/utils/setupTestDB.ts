import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const setupTestDB = () => {
  beforeEach(async () => {
    // Clean up all test data before each test
    await prisma.token.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    // Disconnect Prisma client
    await prisma.$disconnect();
  });
};

export default setupTestDB;
