import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Prisma } from '@prisma/client';
export type RateLimitDatabase = Pick<
  Prisma.TransactionClient,
  '$queryRaw' | '$executeRaw'
>;
type CounterResult = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

// One INSERT ... ON CONFLICT operation locks the bucket across API instances.
// Database time is used throughout; no application clock determines a block.
export class PostgresThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(PostgresThrottlerStorage.name);
  private nextCleanupAt = 0;
  constructor(private readonly database: RateLimitDatabase) {}
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<CounterResult> {
    try {
      const bucket = throttlerName + ':' + key;
      const results = await this.database.$queryRaw<CounterResult[]>`
        INSERT INTO "AuthRateLimitBucket" ("key", "hits", "expiresAt", "blockedUntil", "updatedAt")
        VALUES (
          ${bucket}, 1,
          (statement_timestamp() AT TIME ZONE 'UTC') + ${ttl} * INTERVAL '1 millisecond',
          NULL, (statement_timestamp() AT TIME ZONE 'UTC')
        )
        ON CONFLICT ("key") DO UPDATE SET
          "hits" = CASE
            WHEN "AuthRateLimitBucket"."blockedUntil" > (statement_timestamp() AT TIME ZONE 'UTC') THEN "AuthRateLimitBucket"."hits"
            WHEN "AuthRateLimitBucket"."blockedUntil" IS NOT NULL OR "AuthRateLimitBucket"."expiresAt" <= (statement_timestamp() AT TIME ZONE 'UTC') THEN 1
            ELSE "AuthRateLimitBucket"."hits" + 1 END,
          "expiresAt" = CASE
            WHEN "AuthRateLimitBucket"."blockedUntil" > (statement_timestamp() AT TIME ZONE 'UTC') THEN "AuthRateLimitBucket"."expiresAt"
            WHEN "AuthRateLimitBucket"."blockedUntil" IS NOT NULL OR "AuthRateLimitBucket"."expiresAt" <= (statement_timestamp() AT TIME ZONE 'UTC')
              THEN (statement_timestamp() AT TIME ZONE 'UTC') + ${ttl} * INTERVAL '1 millisecond'
            ELSE "AuthRateLimitBucket"."expiresAt" END,
          "blockedUntil" = CASE
            WHEN "AuthRateLimitBucket"."blockedUntil" > (statement_timestamp() AT TIME ZONE 'UTC') THEN "AuthRateLimitBucket"."blockedUntil"
            WHEN "AuthRateLimitBucket"."blockedUntil" IS NOT NULL OR "AuthRateLimitBucket"."expiresAt" <= (statement_timestamp() AT TIME ZONE 'UTC') THEN NULL
            WHEN "AuthRateLimitBucket"."hits" + 1 > ${limit}
              THEN (statement_timestamp() AT TIME ZONE 'UTC') + ${blockDuration} * INTERVAL '1 millisecond'
            ELSE NULL END,
          "updatedAt" = (statement_timestamp() AT TIME ZONE 'UTC')
        RETURNING "hits" AS "totalHits",
          GREATEST(0, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - (statement_timestamp() AT TIME ZONE 'UTC')))))::INTEGER AS "timeToExpire",
          COALESCE("blockedUntil" > (statement_timestamp() AT TIME ZONE 'UTC'), FALSE) AS "isBlocked",
          COALESCE(GREATEST(0, CEIL(EXTRACT(EPOCH FROM ("blockedUntil" - (statement_timestamp() AT TIME ZONE 'UTC'))))), 0)::INTEGER AS "timeToBlockExpire"
      `;
      const result = results[0];
      if (!result) throw new Error('Missing rate-limit counter result');
      await this.cleanupExpired();
      return result;
    } catch {
      this.logger.error(
        'Shared PostgreSQL authentication rate-limit storage unavailable',
      );
      throw new ServiceUnavailableException(
        'Authentication temporarily unavailable. Please retry later.',
      );
    }
  }
  private async cleanupExpired() {
    if (Date.now() < this.nextCleanupAt) return;
    this.nextCleanupAt = Date.now() + 60_000;
    try {
      // The outer predicate rechecks expiry if another request renews a selected row.
      await this.database.$executeRaw`
        DELETE FROM "AuthRateLimitBucket"
        WHERE "expiresAt" <= (statement_timestamp() AT TIME ZONE 'UTC')
          AND ("blockedUntil" IS NULL OR "blockedUntil" <= (statement_timestamp() AT TIME ZONE 'UTC'))
          AND "key" IN (
            SELECT "key" FROM "AuthRateLimitBucket"
            WHERE "expiresAt" <= (statement_timestamp() AT TIME ZONE 'UTC')
              AND ("blockedUntil" IS NULL OR "blockedUntil" <= (statement_timestamp() AT TIME ZONE 'UTC'))
            ORDER BY "expiresAt" LIMIT 1000
          )
      `;
    } catch {
      this.logger.warn(
        'Expired authentication rate-limit bucket cleanup failed',
      );
    }
  }
}
