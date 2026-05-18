import '../src/config/load-env';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, SystemRole } from '@prisma/client';
import * as argon2 from 'argon2';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const email = process.env.SEED_SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const name = process.env.SEED_SUPER_ADMIN_NAME ?? 'Platform Super Admin';

  if (!email || !password) {
    throw new Error(
      'SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD are required',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(databaseUrl),
  });

  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      systemRole: SystemRole.SUPER_ADMIN,
    },
    create: {
      name,
      email,
      passwordHash,
      systemRole: SystemRole.SUPER_ADMIN,
    },
  });

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
