import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import Redis from 'ioredis';
import { redisConnectionOptions } from '../src/config/redis-options';
import { serverEnvironmentFiles } from '../src/config/environment-files';
import {
  redisRuntimeSummary,
  resolveAuthRedisConnection,
} from '../src/config/redis';

async function main() {
  const base = { ...process.env };
  if (process.argv.includes('--production')) base.NODE_ENV = 'production';
  const files = serverEnvironmentFiles(base);
  const values: Record<string, unknown> = {};
  for (const file of [...files].reverse())
    if (existsSync(file)) Object.assign(values, parse(readFileSync(file)));
  Object.assign(values, base);
  console.log(
    JSON.stringify(
      {
        scope: 'current-process-and-local-environment-files',
        ...redisRuntimeSummary(values),
      },
      null,
      2,
    ),
  );
  if (!process.argv.includes('--probe')) return;
  const connection = resolveAuthRedisConnection(values);
  if (!connection) {
    console.log(
      JSON.stringify({
        redisProbe: 'not-configured',
        message:
          'No Redis connection is required for PostgreSQL production rate limits.',
      }),
    );
    return;
  }
  const options = {
    lazyConnect: true,
    connectTimeout: 2000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  };
  const redis = new Redis({
    ...redisConnectionOptions(connection),
    ...options,
  });
  redis.on('error', () => undefined);
  try {
    await redis.connect();
    await redis.ping();
    console.log(JSON.stringify({ redisProbe: 'up' }));
  } catch {
    console.error(
      JSON.stringify({
        redisProbe: 'unreachable',
        message: 'Check network access, TLS and Redis credentials.',
      }),
    );
    process.exitCode = 1;
  } finally {
    redis.disconnect();
  }
}
void main().catch(() => {
  console.error(
    'Redis configuration is invalid. Use a redis:// or rediss:// TCP URL and valid host/port settings.',
  );
  process.exitCode = 1;
});
