import Redis from 'ioredis';
import { redisConnectionOptions } from './redis-options';

describe('Redis structured connection options', () => {
  it('preserves host configuration without a URL', () => {
    expect(redisConnectionOptions({ host: 'localhost', port: 6380 })).toEqual({
      host: 'localhost',
      port: 6380,
    });
  });

  it('decodes ACL credentials and preserves TLS, port, database and query options', () => {
    expect(
      redisConnectionOptions({
        url: 'rediss://user%40team:p%3Aa%2Fss%25@example.invalid:6380/2?family=6&connectionName=attendance',
      }),
    ).toEqual({
      host: 'example.invalid',
      port: 6380,
      username: 'user@team',
      password: 'p:a/ss%',
      db: 2,
      tls: {},
      family: 6,
      connectionName: 'attendance',
    });
  });

  it('supports password-only authentication and defaults without enabling TLS', () => {
    expect(
      redisConnectionOptions({ url: 'redis://:secret@example.invalid' }),
    ).toEqual({
      host: 'example.invalid',
      port: 6379,
      username: '',
      password: 'secret',
    });
  });

  it('supports IPv6 and query database selection', () => {
    expect(
      redisConnectionOptions({ url: 'redis://[::1]:6380/?db=3&family=6' }),
    ).toEqual({ host: '::1', port: 6380, db: 3, family: 6 });
  });

  it('gives explicit URL fields precedence over query options', () => {
    expect(
      redisConnectionOptions({
        url: 'rediss://user:secret@example.invalid:6380/2?db=9&host=other.invalid&port=1234&tls=false',
      }),
    ).toEqual({
      host: 'example.invalid',
      port: 6380,
      db: 2,
      username: 'user',
      password: 'secret',
      tls: {},
    });
  });

  it.each([
    'redis://user:private-secret@example.invalid/no-db',
    'redis://user:private-secret@example.invalid:99999',
    'redis://user:private-secret@example.invalid/9007199254740992',
    'redis://user:private-secret@example.invalid/?family=bad',
    'redis://user:private-secret@example.invalid/?__proto__=bad',
    'redis://user:private-secret@example.invalid/?constructor=bad',
    'redis://user:private-secret@example.invalid/?prototype=bad',
    'redis://user:%GGprivate-secret@example.invalid',
    'https://user:private-secret@example.invalid',
  ])(
    'rejects invalid configuration without exposing credentials (%#)',
    (url) => {
      let error: Error | undefined;
      try {
        redisConnectionOptions({ url });
      } catch (caught) {
        error = caught as Error;
      }
      expect(error?.message).toBe(
        'Invalid Redis TCP URL: check host, port, credentials and database',
      );
      expect(error?.stack).not.toContain('private-secret');
    },
  );

  it('constructs the real ioredis client without invoking legacy url.parse', () => {
    const legacyUrl = require('node:url') as typeof import('node:url');
    const parse = jest.spyOn(legacyUrl, 'parse').mockImplementation(() => {
      throw new Error('Legacy URL parser must not be called');
    });
    let client: Redis | undefined;
    try {
      client = new Redis({
        ...redisConnectionOptions({
          url: 'rediss://user:secret@example.invalid:6380/2',
        }),
        lazyConnect: true,
      });
      expect(client.options).toMatchObject({
        host: 'example.invalid',
        port: 6380,
        db: 2,
        tls: {},
      });
      expect(parse).not.toHaveBeenCalled();
    } finally {
      client?.disconnect();
      parse.mockRestore();
    }
  });
});
