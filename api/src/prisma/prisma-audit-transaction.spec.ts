import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { getAuditTransaction } from '../audit-logs/audit-transaction';

describe('Prisma transaction audit scope', () => {
  afterEach(() => jest.restoreAllMocks());
  it('binds callback work to its transaction client without leaking the scope', async () => {
    const tx = { marker: 'transaction' };
    jest
      .spyOn(PrismaClient.prototype, '$transaction')
      .mockImplementation(((callback: (client: unknown) => unknown) =>
        callback(tx)) as never);
    const prisma = new PrismaService(
      new ConfigService({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      }),
    );
    await prisma.$transaction(async (client) => {
      expect(client).toBe(tx);
      await Promise.resolve();
      expect(getAuditTransaction(prisma)).toBe(tx);
      expect(getAuditTransaction({})).toBeUndefined();
    });
    expect(getAuditTransaction(prisma)).toBeUndefined();
    await prisma.$disconnect();
  });
  it('preserves array transactions and their options', async () => {
    const call = jest
      .spyOn(PrismaClient.prototype, '$transaction')
      .mockResolvedValue([]);
    const prisma = new PrismaService(
      new ConfigService({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      }),
    );
    const operations: never[] = [];
    await prisma.$transaction(operations, { isolationLevel: 'Serializable' });
    expect(call).toHaveBeenCalledWith(operations, {
      isolationLevel: 'Serializable',
    });
    expect(getAuditTransaction(prisma)).toBeUndefined();
    await prisma.$disconnect();
  });
});
