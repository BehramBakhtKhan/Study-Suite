import { prisma } from "@/lib/prisma";

// Helper to truncate/delete data across all tables in order
export async function clearDatabase() {
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';`;

  const tables = tablenames
    .map(({ tablename }) => `"${tablename}"`)
    .join(", ");

  if (tables.length > 0) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    } catch (error) {
      console.error("Error clearing test database:", error);
    }
  }
}

beforeEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});