type RedisConnection =
  | {
      url: string;
    }
  | {
      host: string;
      port: number;
    };

function readString(
  env: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return undefined;
}

function readNumber(
  env: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = env[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  throw new Error(
    `Invalid environment variable ${key}: expected a positive number`,
  );
}

function isEnabled(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    ['true', '1', 'yes'].includes(value.trim().toLowerCase())
  );
}

export function resolveRedisConnection(
  env: Record<string, unknown>,
): RedisConnection | null {
  const explicitlyEnabled = isEnabled(env.REDIS_ENABLED);
  const url = readString(env, 'REDIS_URL');

  if (!explicitlyEnabled && !url) {
    return null;
  }

  if (url) {
    return { url };
  }

  return {
    host: readString(env, 'REDIS_HOST') ?? '127.0.0.1',
    port: readNumber(env, 'REDIS_PORT') ?? 6379,
  };
}

export function isRedisQueueEnabled(env: Record<string, unknown>): boolean {
  return resolveRedisConnection(env) !== null;
}

export type { RedisConnection };
