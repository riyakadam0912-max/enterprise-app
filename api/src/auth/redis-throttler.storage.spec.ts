import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { ThrottlerStorageService } from '@nestjs/throttler';
import Redis from 'ioredis';
import {
  RedisThrottlerStorage,
  INCREMENT_THROTTLE,
} from './redis-throttler.storage';
import { createAuthThrottleStorage } from './auth-throttling.module';
import { PostgresThrottlerStorage } from './postgres-throttler.storage';
import type { RateLimitDatabase } from './postgres-throttler.storage';

describe('Shared authentication throttle storage', () => {
  const redis = {
    status: 'ready',
    eval: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
  let storage: RedisThrottlerStorage;
  beforeEach(() => {
    jest.resetAllMocks();
    redis.status = 'ready';
    storage = new RedisThrottlerStorage(redis as unknown as Redis);
  });

  it('uses an atomic namespaced counter and reports retry times in seconds', async () => {
    redis.eval.mockResolvedValue([6, 59_001, 1, 60_000]);
    await expect(
      storage.increment('route-client', 60_000, 5, 60_000, 'default'),
    ).resolves.toEqual({
      totalHits: 6,
      timeToExpire: 60,
      isBlocked: true,
      timeToBlockExpire: 60,
    });
    expect(redis.eval).toHaveBeenCalledWith(
      INCREMENT_THROTTLE,
      1,
      'enterprise:auth-throttle:default:route-client',
      60_000,
      5,
      60_000,
    );
  });

  it('fails closed when Redis is unavailable', async () => {
    redis.eval.mockRejectedValue(new Error('connection unavailable'));
    await expect(
      storage.increment('key', 60_000, 5, 60_000, 'default'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('shares a single lazy connection across concurrent requests', async () => {
    redis.status = 'wait';
    redis.connect.mockImplementation(async () => {
      redis.status = 'ready';
    });
    redis.eval.mockResolvedValue([1, 60_000, 0, 0]);
    await Promise.all([
      storage.increment('one', 60_000, 5, 60_000, 'default'),
      storage.increment('two', 60_000, 5, 60_000, 'default'),
    ]);
    expect(redis.connect).toHaveBeenCalledTimes(1);
  });

  it('can reconnect after a failed connection', async () => {
    redis.status = 'end';
    redis.connect
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(async () => {
        redis.status = 'ready';
      });
    redis.eval.mockResolvedValue([1, 60_000, 0, 0]);
    await expect(
      storage.increment('key', 60_000, 5, 60_000, 'default'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      storage.increment('key', 60_000, 5, 60_000, 'default'),
    ).resolves.toMatchObject({ isBlocked: false });
  });

  it('disconnects on application shutdown', () => {
    storage.onModuleDestroy();
    expect(redis.disconnect).toHaveBeenCalledTimes(1);
  });

  it('uses shared PostgreSQL instead of requiring Redis in production', () => {
    const database = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    expect(
      createAuthThrottleStorage(
        new ConfigService({
          NODE_ENV: 'production',
          RATE_LIMIT_REDIS_URL: '',
          REDIS_URL: '',
          REDIS_ENABLED: false,
        }),
        database as RateLimitDatabase,
      ),
    ).toBeInstanceOf(PostgresThrottlerStorage);
  });

  it('supports Redis-free development', () => {
    expect(
      createAuthThrottleStorage(
        new ConfigService({
          NODE_ENV: 'development',
          RATE_LIMIT_REDIS_URL: '',
          REDIS_URL: '',
        }),
      ),
    ).toBeInstanceOf(ThrottlerStorageService);
  });

  it('allows a dedicated shared store without enabling application queues', () => {
    const shared = createAuthThrottleStorage(
      new ConfigService({
        NODE_ENV: 'production',
        RATE_LIMIT_REDIS_URL: 'redis://127.0.0.1:6379',
        REDIS_URL: '',
      }),
    );
    expect(shared).toBeInstanceOf(RedisThrottlerStorage);
    (shared as RedisThrottlerStorage).onModuleDestroy();
  });
});
