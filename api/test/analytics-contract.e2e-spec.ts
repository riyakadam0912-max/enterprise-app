import { CacheInterceptor } from '@nestjs/cache-manager';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AnalyticsController } from '../src/analytics/analytics.controller';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LeadsController } from '../src/leads/leads.controller';
import { LeadsService } from '../src/leads/leads.service';

describe('Analytics summary and API envelope contracts (e2e)', () => {
  let app: INestApplication<App> | undefined;

  const analyticsSummary = {
    absenteeism: {
      totalEmployees: 125,
      presentCount: 113,
      absenteeismRate: 9.6,
    },
    burnRate: {
      payroll: 245000,
      expenses: 42000,
      total: 287000,
    },
    revenueVelocity: {
      averageDays: 18.42,
    },
  };

  const analyticsService = {
    getSummary: jest.fn().mockResolvedValue(analyticsSummary),
  };

  const leadsService = {
    remove: jest.fn().mockResolvedValue({
      id: 7,
      deletedAt: '2026-01-01T00:00:00.000Z',
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController, LeadsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: analyticsService,
        },
        {
          provide: LeadsService,
          useValue: leadsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: {
          switchToHttp: () => { getRequest: <T>() => T };
        }) {
          const request = context.switchToHttp().getRequest<{
            user?: { userId: number; role: string; organizationId: number };
          }>();
          request.user = {
            userId: 1,
            role: 'ADMIN',
            organizationId: 1,
          };

          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .overrideInterceptor(CacheInterceptor)
      .useValue({
        intercept: (_context: unknown, next: { handle: () => unknown }) =>
          next.handle(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns analytics summary in the shared success envelope', async () => {
    await request(app!.getHttpServer())
      .get('/api/v1/analytics/summary')
      .expect(200)
      .expect({
        success: true,
        message: 'Request successful',
        data: analyticsSummary,
      });

    expect(analyticsService.getSummary).toHaveBeenCalledTimes(1);
  });

  it('wraps delete responses in the shared success envelope', async () => {
    await request(app!.getHttpServer())
      .delete('/api/v1/leads/7')
      .expect(200)
      .expect({
        success: true,
        message: 'Request successful',
        data: {
          id: 7,
          deletedAt: '2026-01-01T00:00:00.000Z',
        },
      });

    expect(leadsService.remove).toHaveBeenCalledWith(7, {
      userId: 1,
      role: 'ADMIN',
      organizationId: 1,
    });
  });

  it('wraps delete failures in the shared error envelope', async () => {
    leadsService.remove.mockRejectedValueOnce(
      new NotFoundException('Lead #8 not found'),
    );

    await request(app!.getHttpServer())
      .delete('/api/v1/leads/8')
      .expect(404)
      .expect({
        success: false,
        message: 'Lead #8 not found',
        data: null,
      });
  });
});
