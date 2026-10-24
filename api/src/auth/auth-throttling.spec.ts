import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AuthThrottlingModule } from './auth-throttling.module';

// Exercise the actual controller decorators, guard, and storage via HTTP.
describe('Authentication rate limits', () => {
  let app: INestApplication;
  let service: Record<string, jest.Mock>;
  const originalVercel = process.env.VERCEL;

  beforeEach(async () => {
    process.env.VERCEL = '0';
    service = Object.fromEntries(
      [
        'bootstrapAdmin',
        'bootstrapSuperAdmin',
        'resetPassword',
        'login',
        'refreshTokens',
        'requestPasswordReset',
        'logout',
      ].map((method) => [
        method,
        jest.fn().mockResolvedValue({
          access_token: 'access',
          refresh_token: 'refresh',
        }),
      ]),
    );
    const module = await Test.createTestingModule({
      imports: [AuthThrottlingModule],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: service },
        { provide: PrismaService, useValue: {} },
        ConfigService,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => (key === 'NODE_ENV' ? 'test' : undefined),
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().user = { userId: 1 };
          return true;
        },
      })
      .compile();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    jest.useRealTimers();
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it.each([
    ['bootstrap-admin', 'bootstrapAdmin', 1],
    ['bootstrap-super-admin', 'bootstrapSuperAdmin', 1],
    ['reset-password', 'resetPassword', 5],
    ['login', 'login', 5],
    ['refresh', 'refreshTokens', 5],
    ['forgot-password', 'requestPasswordReset', 5],
    ['logout', 'logout', 20],
  ] as const)(
    '%s blocks excess requests for a full minute and then recovers',
    async (route, method, limit) => {
      const send = () =>
        request(app.getHttpServer())
          .post('/auth/' + route)
          .send({
            email: 'test@example.com',
            password: 'password',
            token: 'reset',
          });
      for (let i = 0; i < limit; i++) await send().expect(201);
      expect(service[method]).toHaveBeenCalledTimes(limit);
      // Catch the original 60ms bug, even when excess requests are not immediate.
      await jest.advanceTimersByTimeAsync(100);
      const blocked = await send().expect(429);
      expect(Number(blocked.headers['retry-after'])).toBe(60);
      await jest.advanceTimersByTimeAsync(59_999);
      await send().expect(429);
      expect(service[method]).toHaveBeenCalledTimes(limit);
      await jest.advanceTimersByTimeAsync(1);
      await send().expect(201);
      expect(service[method]).toHaveBeenCalledTimes(limit + 1);
    },
  );

  it('does not bypass login limits by rotating caller-provided forwarding headers', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', '198.51.100.' + (i + 1))
        .set('X-Vercel-Forwarded-For', '203.0.113.' + (i + 1))
        .send({})
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.99')
      .set('X-Vercel-Forwarded-For', '203.0.113.99')
      .send({})
      .expect(429);
    // A different route has its own budget.
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({})
      .expect(201);
    expect(service.login).toHaveBeenCalledTimes(5);
  });

  it('resolves trusted proxy chains without accepting spoofed leftmost IPs', async () => {
    app.getHttpAdapter().getInstance().set('trust proxy', ['loopback']);
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', '198.51.100.' + (i + 1) + ', 203.0.113.9')
        .send({})
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.99, 203.0.113.9')
      .send({})
      .expect(429);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.99, 203.0.113.10')
      .send({})
      .expect(201);
  });
});
