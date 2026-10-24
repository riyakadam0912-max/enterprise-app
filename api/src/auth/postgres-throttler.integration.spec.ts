import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PostgresThrottlerStorage } from './postgres-throttler.storage';
const url = process.env.TEST_RATE_LIMIT_DATABASE_URL;
const describeDatabase = url ? describe : describe.skip;
describeDatabase(
  'PostgreSQL authentication limits against a disposable migrated database',
  () => {
    let first: PrismaClient, second: PrismaClient;
    const name = randomUUID();
    beforeAll(() => {
      first = new PrismaClient({ datasources: { db: { url: url! } } });
      second = new PrismaClient({ datasources: { db: { url: url! } } });
    });
    afterAll(async () => {
      await first.authRateLimitBucket.deleteMany({
        where: { key: { startsWith: name + ':' } },
      });
      await first.$disconnect();
      await second.$disconnect();
    });
    it('shares atomic limits between clients and recovers after the block expires', async () => {
      const firstStore = new PostgresThrottlerStorage(first);
      const secondStore = new PostgresThrottlerStorage(second);
      const key = randomUUID();
      const hits = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          (i % 2 ? firstStore : secondStore).increment(
            key,
            1000,
            5,
            1000,
            name,
          ),
        ),
      );
      expect(hits.map((hit) => hit.totalHits).sort((a, b) => a - b)).toEqual([
        1, 2, 3, 4, 5, 6,
      ]);
      expect(hits.filter((hit) => hit.isBlocked)).toHaveLength(1);
      await expect(
        secondStore.increment(key, 1000, 5, 1000, name),
      ).resolves.toMatchObject({ isBlocked: true });
      await expect(
        firstStore.increment(key + '-other-client', 1000, 5, 1000, name),
      ).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await expect(
        secondStore.increment(key, 1000, 5, 1000, name),
      ).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
    });
  },
);
