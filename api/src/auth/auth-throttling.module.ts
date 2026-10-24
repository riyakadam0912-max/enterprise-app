import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerStorageService } from '@nestjs/throttler';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';
import { AUTH_THROTTLE_DEFAULT } from './auth-throttle.config';
import { RedisThrottlerStorage } from './redis-throttler.storage';

export function createAuthThrottleStorage(
  config: ConfigService,
): ThrottlerStorage {
  const url =
    config.get<string>('RATE_LIMIT_REDIS_URL')?.trim() ||
    config.get<string>('REDIS_URL')?.trim();
  if (!url) {
    if (config.get<string>('NODE_ENV') === 'production') {
      throw new Error(
        'Production authentication throttling requires RATE_LIMIT_REDIS_URL or REDIS_URL',
      );
    }
    return new ThrottlerStorageService();
  }
  const redis = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 2000,
    retryStrategy: () => null,
  });
  // The storage adapter translates errors to a generic 503 without leaking URLs.
  redis.on('error', () => undefined);
  return new RedisThrottlerStorage(redis);
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'AUTH_THROTTLE_STORAGE',
      inject: [ConfigService],
      useFactory: createAuthThrottleStorage,
    },
  ],
  exports: ['AUTH_THROTTLE_STORAGE'],
})
class AuthThrottleStorageModule {}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [AuthThrottleStorageModule],
      inject: ['AUTH_THROTTLE_STORAGE'],
      useFactory: (storage: ThrottlerStorage) => ({
        throttlers: [{ name: 'default', ...AUTH_THROTTLE_DEFAULT }],
        storage,
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class AuthThrottlingModule {}
