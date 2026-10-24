import { ServiceUnavailableException } from '@nestjs/common';
import { PostgresThrottlerStorage } from './postgres-throttler.storage';
import type { RateLimitDatabase } from './postgres-throttler.storage';

describe('PostgreSQL shared authentication counters', () => {
  const database = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
  let storage: PostgresThrottlerStorage;
  beforeEach(() => {
    jest.resetAllMocks();
    database.$executeRaw.mockResolvedValue(0);
    storage = new PostgresThrottlerStorage(database as RateLimitDatabase);
  });
  it('returns the database decision including a complete retry window', async () => {
    const result = {
      totalHits: 6,
      timeToExpire: 59,
      isBlocked: true,
      timeToBlockExpire: 60,
    };
    database.$queryRaw.mockResolvedValue([result]);
    await expect(
      storage.increment('hashed-client-route', 60_000, 5, 60_000, 'default'),
    ).resolves.toEqual(result);
    expect(database.$queryRaw.mock.calls[0].slice(1)).toEqual([
      'default:hashed-client-route',
      60_000,
      60_000,
      5,
      60_000,
    ]);
  });
  it('fails closed during a database outage', async () => {
    database.$queryRaw.mockRejectedValue(new Error('unavailable'));
    await expect(
      storage.increment('key', 60_000, 5, 60_000, 'default'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('does not reset a valid counter when housekeeping fails', async () => {
    database.$queryRaw.mockResolvedValue([
      {
        totalHits: 2,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      },
    ]);
    database.$executeRaw.mockRejectedValue(new Error('cleanup failed'));
    await expect(
      storage.increment('key', 60_000, 5, 60_000, 'default'),
    ).resolves.toMatchObject({ totalHits: 2, isBlocked: false });
  });
  it('bounds cleanup to once per minute without background timers', async () => {
    database.$queryRaw.mockResolvedValue([
      {
        totalHits: 2,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      },
    ]);
    await storage.increment('one', 60_000, 5, 60_000, 'default');
    await storage.increment('two', 60_000, 5, 60_000, 'default');
    expect(database.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
