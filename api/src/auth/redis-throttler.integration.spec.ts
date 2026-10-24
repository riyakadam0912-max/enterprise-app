import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { RedisThrottlerStorage } from './redis-throttler.storage';

// Explicitly use a disposable Redis; never infer production credentials.
const url = process.env.TEST_RATE_LIMIT_REDIS_URL;
const describeRedis = url ? describe : describe.skip;
describeRedis('Authentication throttling against Redis', () => {
  let first: RedisThrottlerStorage;
  let second: RedisThrottlerStorage;
  const name = randomUUID();
  beforeAll(() => {
    first = new RedisThrottlerStorage(new Redis(url!, { lazyConnect: true }));
    second = new RedisThrottlerStorage(new Redis(url!, { lazyConnect: true }));
  });
  afterAll(() => {
    first.onModuleDestroy();
    second.onModuleDestroy();
  });

  it('shares atomic limits between instances and recovers after expiry', async () => {
    const key = randomUUID();
    const hits = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        (i % 2 ? first : second).increment(key, 1000, 5, 1000, name),
      ),
    );
    expect(hits.map((hit) => hit.totalHits).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(hits.filter((hit) => hit.isBlocked)).toHaveLength(1);
    await expect(
      first.increment(key, 1000, 5, 1000, name),
    ).resolves.toMatchObject({ isBlocked: true });
    await expect(
      second.increment(key + '-other-client', 1000, 5, 1000, name),
    ).resolves.toMatchObject({ isBlocked: false });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await expect(
      second.increment(key, 1000, 5, 1000, name),
    ).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
  });
});
