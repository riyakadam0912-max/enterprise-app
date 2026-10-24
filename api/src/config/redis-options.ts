import type { RedisOptions } from 'ioredis';
import type { RedisConnection } from './redis';
import { validateRedisUrl } from './redis';

/** Use structured options so ioredis never invokes its legacy URL parser. */
export function redisConnectionOptions(
  connection: RedisConnection,
): RedisOptions {
  if (!('url' in connection)) return { ...connection };
  try {
    const url = new URL(validateRedisUrl(connection.url));
    // Keep ioredis URL query options, including their existing string values.
    // Explicit URL components take precedence over query parameters.
    const options: RedisOptions = Object.fromEntries(url.searchParams);
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      if (url.searchParams.has(key)) throw new Error();
    }
    options.host = url.hostname.replace(/^\[|\]$/g, '');
    options.port = url.port ? Number(url.port) : 6379;
    if (
      !Number.isInteger(options.port) ||
      options.port < 1 ||
      options.port > 65535
    )
      throw new Error();
    if (url.username || url.password) {
      options.username = decodeURIComponent(url.username);
      options.password = decodeURIComponent(url.password);
    }
    const database =
      url.pathname.length > 1
        ? url.pathname.slice(1)
        : url.searchParams.get('db');
    if (database !== null) {
      if (!/^\d+$/.test(database)) throw new Error();
      options.db = Number(database);
      if (!Number.isSafeInteger(options.db)) throw new Error();
    }
    const family = url.searchParams.get('family');
    if (family !== null) {
      if (!['0', '4', '6'].includes(family)) throw new Error();
      options.family = Number(family);
    }
    if (url.protocol === 'rediss:') options.tls = {};
    return options;
  } catch {
    // Parsing exceptions can contain the original URL, including credentials.
    throw new Error(
      'Invalid Redis TCP URL: check host, port, credentials and database',
    );
  }
}
