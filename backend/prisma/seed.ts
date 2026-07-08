import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcrypt';

// Use same Prisma setup as main app
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Test users from README.md
const testUsers = [
  { email: 'admin@example.com', name: 'Admin User', phone: '555-100-0001', role: 'ADMIN', password: 'swim@876' },
  { email: 'bob@example.com', name: 'Bob Technician', phone: '555-100-0002', role: 'TECHNICIAN', password: 'swim@876' },
  { email: 'alice@example.com', name: 'Alice Customer', phone: '555-100-0003', role: 'CUSTOMER', password: 'swim@876' },
];

async function main() {
  console.log('🌱 Seeding database...');

  for (const userData of testUsers) {
    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    if (!existing) {
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          phone: userData.phone,
          role: userData.role as 'ADMIN' | 'TECHNICIAN' | 'CUSTOMER',
          password: hashedPassword,
        },
      });
      console.log(`✅ Created ${user.role}: ${user.email}`);
    } else {
      await prisma.user.update({
        where: { email: userData.email },
        data: { password: hashedPassword },
      });
      console.log(`🔄 Updated password for existing user: ${userData.email}`);
    }
  }

  // Also promote sheeba.hbti@gmail.com to ADMIN if exists
  const sheeba = await prisma.user.findUnique({
    where: { email: 'sheeba.hbti@gmail.com' },
  });

  if (sheeba && sheeba.role !== 'ADMIN') {
    await prisma.user.update({
      where: { email: 'sheeba.hbti@gmail.com' },
      data: { role: 'ADMIN' },
    });
    console.log('✅ sheeba.hbti@gmail.com promoted to ADMIN');
  }

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
