import {
  isRedisQueueEnabled,
  redisRuntimeSummary,
  resolveAuthRedisConnection,
  resolveRateLimitBackend,
  resolveRedisConnection,
  validateRedisUrl,
} from './redis';

describe('Independent Redis runtime policies', () => {
  it('uses shared PostgreSQL in production without Redis', () => {
    expect(
      resolveRateLimitBackend({
        NODE_ENV: 'production',
        REDIS_ENABLED: 'false',
      }),
    ).toBe('postgresql');
  });
  it('uses memory in local development without Redis', () => {
    expect(resolveRateLimitBackend({ NODE_ENV: 'development' })).toBe('memory');
  });
  it('prefers the dedicated URL without starting background queues', () => {
    const env = {
      NODE_ENV: 'production',
      RATE_LIMIT_REDIS_URL: 'rediss://dedicated.invalid:6380',
      REDIS_URL: 'redis://general.invalid:6379',
      REDIS_ENABLED: 'false',
    };
    expect(resolveAuthRedisConnection(env)).toEqual({
      url: env.RATE_LIMIT_REDIS_URL,
    });
    expect(resolveRateLimitBackend(env)).toBe('redis');
    expect(resolveRedisConnection(env)).toBeNull();
  });
  it('does not treat REDIS_URL as permission to run a worker', () => {
    const env = { REDIS_URL: 'redis://general.invalid:6379' };
    expect(resolveRateLimitBackend(env)).toBe('redis');
    expect(isRedisQueueEnabled(env)).toBe(false);
  });
  it('disables persistent workers on Vercel even when Redis is configured', () => {
    const env = {
      NODE_ENV: 'production',
      VERCEL: '1',
      REDIS_QUEUE_ENABLED: 'true',
      REDIS_URL: 'rediss://general.invalid:6379',
    };
    expect(resolveRateLimitBackend(env)).toBe('redis');
    expect(resolveRedisConnection(env)).toBeNull();
  });
  it('supports explicit queue enablement and the legacy flag on persistent hosts', () => {
    expect(
      resolveRedisConnection({
        REDIS_QUEUE_ENABLED: true,
        REDIS_URL: 'redis://general.invalid:6379',
      }),
    ).toEqual({ url: 'redis://general.invalid:6379' });
    expect(
      resolveRedisConnection({
        REDIS_ENABLED: 'true',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6380',
      }),
    ).toEqual({ host: 'localhost', port: 6380 });
  });
  it('allows explicit queue disablement while using host-based auth Redis', () => {
    const env = {
      REDIS_ENABLED: true,
      REDIS_QUEUE_ENABLED: false,
      REDIS_HOST: 'localhost',
    };
    expect(resolveAuthRedisConnection(env)).toEqual({
      host: 'localhost',
      port: 6379,
    });
    expect(isRedisQueueEnabled(env)).toBe(false);
  });
  it('never silently connects to localhost when Redis is enabled in production', () => {
    expect(() =>
      resolveAuthRedisConnection({
        NODE_ENV: 'production',
        REDIS_ENABLED: true,
      }),
    ).toThrow('REDIS_HOST or REDIS_URL');
  });
  it.each(['https://rest.invalid', 'http://rest.invalid', 'not-a-url'])(
    'rejects non-TCP Redis URLs without echoing credentials: %s',
    (url) => {
      expect(() => validateRedisUrl(url)).toThrow('redis:// or rediss://');
    },
  );
  it.each(['0', '65536', '1.5'])('rejects invalid Redis ports: %s', (port) => {
    expect(() =>
      resolveRedisConnection({ REDIS_ENABLED: true, REDIS_PORT: port }),
    ).toThrow('REDIS_PORT');
  });
  it('reports active consumers without revealing connection credentials', () => {
    const summary = redisRuntimeSummary({
      NODE_ENV: 'production',
      VERCEL: '1',
      REDIS_URL: 'rediss://user:private-password@private-host.invalid:6379',
    });
    expect(summary.rateLimits).toMatchObject({
      backend: 'redis',
      shared: true,
    });
    expect(summary.cache.backend).toBe('memory');
    expect(summary.auditRecords.backend).toBe('postgresql');
    expect(JSON.stringify(summary)).not.toContain('private-');
  });
});
