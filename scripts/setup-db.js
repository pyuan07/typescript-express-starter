#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

console.log('🚀 Setting up database...\n');

// Check if .env file exists
if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    console.log('📄 Copying .env.example to .env...');
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created');
    console.log('⚠️  Please update the DATABASE_URL and other variables in .env file\n');
  } else {
    console.error('❌ No .env.example file found. Please create .env file manually.');
    process.exit(1);
  }
} else {
  console.log('✅ .env file already exists');
}

try {
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated\n');

  console.log('🗃️  Pushing database schema...');
  execSync('npx prisma db push', { stdio: 'inherit' });
  console.log('✅ Database schema applied\n');

  console.log('🌱 Seeding database...');
  execSync('npm run db:seed', { stdio: 'inherit' });
  console.log('✅ Database seeded\n');

  console.log('🎉 Database setup completed successfully!');
  console.log('\n📍 Next steps:');
  console.log('   1. Update your .env file with correct database credentials');
  console.log('   2. Run "npm run dev" to start the development server');
  console.log('   3. Visit http://localhost:3000/v1/docs for API documentation');
  console.log('\n🔐 Default users created:');
  console.log('   Admin: admin@example.com / admin123');
  console.log('   User:  user@example.com / user123');
} catch (error) {
  console.error('❌ Database setup failed:', error.message);
  console.log('\n💡 Troubleshooting:');
  console.log('   1. Make sure PostgreSQL is running');
  console.log('   2. Check your DATABASE_URL in .env file');
  console.log('   3. Ensure the database exists');
  process.exit(1);
}
