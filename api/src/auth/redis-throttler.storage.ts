import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

// One atomic operation and one key per route/client, using Redis's clock.
// Fixed window, followed by a full block duration after the first excess hit.
export const INCREMENT_THROTTLE = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local duration = tonumber(ARGV[3])
local values = redis.call('HMGET', KEYS[1], 'hits', 'expires', 'blocked')
local hits = tonumber(values[1]) or 0
local expires = tonumber(values[2]) or 0
local blocked = tonumber(values[3]) or 0
if blocked > now then
  return {hits, math.max(0, expires - now), 1, blocked - now}
end
if blocked > 0 or expires <= now then
  hits = 0
  expires = now + ttl
  blocked = 0
end
hits = hits + 1
if hits > limit then blocked = now + duration end
redis.call('HSET', KEYS[1], 'hits', hits, 'expires', expires, 'blocked', blocked)
redis.call('PEXPIRE', KEYS[1], math.max(expires, blocked) - now)
return {hits, math.max(0, expires - now), blocked > now and 1 or 0, math.max(0, blocked - now)}
`;

export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private connection: Promise<void> | null = null;

  constructor(private readonly redis: Redis) {}

  private async ensureConnected() {
    if (this.redis.status === 'ready') return;
    if (!this.connection) {
      this.connection = this.redis.connect().finally(() => {
        this.connection = null;
      });
    }
    await this.connection;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    try {
      await this.ensureConnected();
      const result = (await this.redis.eval(
        INCREMENT_THROTTLE,
        1,
        'enterprise:auth-throttle:' + throttlerName + ':' + key,
        ttl,
        limit,
        blockDuration,
      )) as number[];
      const [totalHits, expiresMs, blocked, blockMs] = result;
      return {
        totalHits,
        timeToExpire: Math.ceil(expiresMs / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(blockMs / 1000),
      };
    } catch {
      // Never fall back to process-local counters during an outage.
      this.logger.error('Shared authentication rate-limit storage unavailable');
      throw new ServiceUnavailableException(
        'Authentication temporarily unavailable. Please retry later.',
      );
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
