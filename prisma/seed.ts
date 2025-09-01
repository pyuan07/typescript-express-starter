import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 8);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPasswordHash,
      role: Role.ADMIN,
      isEmailVerified: true,
    },
  });

  console.log('Created admin user:', adminUser.email);

  // Create regular user
  const userPasswordHash = await bcrypt.hash('user123', 8);
  const regularUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      name: 'Regular User',
      password: userPasswordHash,
      role: Role.USER,
      isEmailVerified: true,
    },
  });

  console.log('Created regular user:', regularUser.email);

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
