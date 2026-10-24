import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { VercelThrottlerGuard } from './vercel-throttler.guard';

class TrackerGuard extends VercelThrottlerGuard {
  tracker(req: Record<string, any>) {
    return this.getTracker(req);
  }
}

describe('Authentication client identity', () => {
  const originalVercel = process.env.VERCEL;
  const guard = new TrackerGuard(
    [],
    new ThrottlerStorageService(),
    new Reflector(),
  );
  afterEach(() => {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it('ignores both forwarding headers outside Vercel', async () => {
    process.env.VERCEL = '0';
    await expect(
      guard.tracker({
        headers: {
          'x-forwarded-for': '198.51.100.1',
          'x-vercel-forwarded-for': '198.51.100.2',
        },
        socket: { remoteAddress: '127.0.0.1' },
      }),
    ).resolves.toBe('127.0.0.1');
  });

  it('uses the platform-managed Vercel IP instead of arbitrary XFF', async () => {
    process.env.VERCEL = '1';
    await expect(
      guard.tracker({
        headers: {
          'x-forwarded-for': '198.51.100.1',
          'x-vercel-forwarded-for': '203.0.113.2',
        },
        ip: '127.0.0.1',
      }),
    ).resolves.toBe('203.0.113.2');
  });

  it.each(['spoofed', '203.0.113.2, 198.51.100.1', ['203.0.113.2'], ''])(
    'rejects malformed platform headers: %p',
    async (value) => {
      process.env.VERCEL = '1';
      await expect(
        guard.tracker({
          headers: { 'x-vercel-forwarded-for': value },
          socket: { remoteAddress: '127.0.0.1' },
        }),
      ).resolves.toBe('127.0.0.1');
    },
  );

  it('accepts IPv6 platform addresses', async () => {
    process.env.VERCEL = '1';
    await expect(
      guard.tracker({ headers: { 'x-vercel-forwarded-for': '2001:db8::1' } }),
    ).resolves.toBe('2001:db8::1');
  });

  it('uses Express resolved IPs on persistent hosts', async () => {
    process.env.VERCEL = '0';
    await expect(
      guard.tracker({
        ip: '203.0.113.9',
        socket: { remoteAddress: '127.0.0.1' },
      }),
    ).resolves.toBe('203.0.113.9');
  });
});
