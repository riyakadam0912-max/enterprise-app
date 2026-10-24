export type RedisConnection = { url: string } | { host: string; port: number };
export type RateLimitBackend = 'redis' | 'postgresql' | 'memory';
function readString(
  env: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function enabled(value: unknown): boolean {
  return (
    value === true ||
    (typeof value === 'string' &&
      ['true', '1', 'yes'].includes(value.trim().toLowerCase()))
  );
}
export function validateRedisUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (!['redis:', 'rediss:'].includes(parsed.protocol) || !parsed.hostname)
      throw new Error();
    return value;
  } catch {
    throw new Error(
      'Redis requires a redis:// or rediss:// TCP URL; REST URLs are not supported',
    );
  }
}
function hostConnection(env: Record<string, unknown>): RedisConnection {
  const host = readString(env, 'REDIS_HOST');
  if (!host && env.NODE_ENV === 'production')
    throw new Error(
      'Production host-based Redis requires REDIS_HOST or REDIS_URL',
    );
  const port = Number(env.REDIS_PORT ?? 6379);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('REDIS_PORT must be an integer between 1 and 65535');
  return { host: host ?? '127.0.0.1', port };
}
export function resolveAuthRedisConnection(
  env: Record<string, unknown>,
): RedisConnection | null {
  const url =
    readString(env, 'RATE_LIMIT_REDIS_URL') ?? readString(env, 'REDIS_URL');
  if (url) return { url: validateRedisUrl(url) };
  return enabled(env.REDIS_ENABLED) ? hostConnection(env) : null;
}
export function resolveRateLimitBackend(
  env: Record<string, unknown>,
): RateLimitBackend {
  return resolveAuthRedisConnection(env)
    ? 'redis'
    : env.NODE_ENV === 'production'
      ? 'postgresql'
      : 'memory';
}
export function isRedisQueueEnabled(env: Record<string, unknown>): boolean {
  // Redis for rate limits must never implicitly start a persistent queue worker.
  return (
    env.VERCEL !== '1' && enabled(env.REDIS_QUEUE_ENABLED ?? env.REDIS_ENABLED)
  );
}
export function resolveRedisConnection(
  env: Record<string, unknown>,
): RedisConnection | null {
  if (!isRedisQueueEnabled(env)) return null;
  const url = readString(env, 'REDIS_URL');
  return url ? { url: validateRedisUrl(url) } : hostConnection(env);
}
export function redisRuntimeSummary(env: Record<string, unknown>) {
  const backend = resolveRateLimitBackend(env);
  const queues = isRedisQueueEnabled(env);
  if (queues) resolveRedisConnection(env); // Validate the actual queue configuration.
  return {
    rateLimits: {
      backend,
      shared: backend !== 'memory',
      configuredSource: readString(env, 'RATE_LIMIT_REDIS_URL')
        ? 'RATE_LIMIT_REDIS_URL'
        : readString(env, 'REDIS_URL')
          ? 'REDIS_URL'
          : enabled(env.REDIS_ENABLED)
            ? 'REDIS_HOST'
            : backend === 'postgresql'
              ? 'DATABASE_URL'
              : 'none',
    },
    queues: {
      enabled: queues,
      mode: queues ? 'redis-worker' : 'inline',
      reason:
        env.VERCEL === '1'
          ? 'serverless-host'
          : queues
            ? 'explicitly-enabled'
            : 'disabled',
    },
    cache: { backend: 'memory', shared: false, ttlMs: 300_000 },
    auditRecords: { backend: 'postgresql' },
    websockets: {
      enabled:
        env.VERCEL !== '1' &&
        enabled(env.WEBSOCKET_ENABLED ?? env.NODE_ENV !== 'production'),
      adapter: 'in-process',
      redisAdapterInstalled: false,
    },
  };
}
