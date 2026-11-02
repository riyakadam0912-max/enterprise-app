import { PrismaClient } from '@prisma/client';

export class DatabaseHelper {
  private static prisma: PrismaClient | null = null;

  static getPrismaClient(): PrismaClient {
    if (!this.prisma) {
      this.prisma = new PrismaClient();
    }
    return this.prisma;
  }

  static async truncateAllTables(): Promise<void> {
    const prisma = this.getPrismaClient();
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations'
      ORDER BY tablename
    `;
    if (tables.length === 0) {
      return;
    }

    const names = tables
      .map(({ tablename }) => `"${tablename.replace(/"/g, '""')}"`)
      .join(', ');
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`,
    );
  }

  static async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
  }
}
