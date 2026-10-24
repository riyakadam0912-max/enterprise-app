import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerStorageService } from '@nestjs/throttler';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';
import { AUTH_THROTTLE_DEFAULT } from './auth-throttle.config';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { PostgresThrottlerStorage } from './postgres-throttler.storage';
import type { RateLimitDatabase } from './postgres-throttler.storage';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveAuthRedisConnection,
  resolveRateLimitBackend,
} from '../config/redis';

export function createAuthThrottleStorage(
  config: ConfigService,
  database?: RateLimitDatabase,
): ThrottlerStorage {
  const env = Object.fromEntries(
    [
      'NODE_ENV',
      'VERCEL',
      'RATE_LIMIT_REDIS_URL',
      'REDIS_URL',
      'REDIS_ENABLED',
      'REDIS_HOST',
      'REDIS_PORT',
    ].map((key) => [key, config.get(key)]),
  );
  const backend = resolveRateLimitBackend(env);
  const logger = new Logger('AuthThrottling');
  logger.log('Authentication rate-limit backend: ' + backend);
  if (backend === 'postgresql') {
    if (!database)
      throw new Error(
        'PostgreSQL rate limiting requires the application database client',
      );
    return new PostgresThrottlerStorage(database);
  }
  if (backend === 'memory') return new ThrottlerStorageService();
  const connection = resolveAuthRedisConnection(env)!;
  const options = {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 2000,
    retryStrategy: () => null,
  };
  const redis =
    'url' in connection
      ? new Redis(connection.url, options)
      : new Redis({ ...connection, ...options });
  redis.on('error', () => undefined);
  return new RedisThrottlerStorage(redis);
}

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    {
      provide: 'AUTH_THROTTLE_STORAGE',
      inject: [ConfigService, PrismaService],
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
