import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DashboardController } from '../src/dashboard/dashboard.controller';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { MetricsService } from '../src/common/services/metrics.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Dashboard workflow contract (e2e)', () => {
  let app: INestApplication<App> | undefined;

  const workflowLeaves = [
    {
      id: 31,
      leaveType: 'PAID',
      status: 'PENDING_HR',
      updatedAt: '2026-04-22T10:00:00.000Z',
      approvalTrail: [
        {
          action: 'SUBMITTED',
          at: '2026-04-21T10:00:00.000Z',
          byUserId: 7,
          reason: null,
        },
        {
          action: 'MANAGER_APPROVED',
          at: '2026-04-22T09:00:00.000Z',
          byUserId: 2,
          reason: null,
        },
      ],
      reason: 'Family function',
      employee: { name: 'Asha Verma' },
    },
  ];

  const workflowExpenses = [
    {
      id: 41,
      category: 'Travel',
      description: 'Client visit',
      status: 'PENDING_MANAGER',
      updatedAt: '2026-04-22T08:00:00.000Z',
      approvalTrail: [
        {
          action: 'SUBMITTED',
          at: '2026-04-21T08:00:00.000Z',
          byUserId: 9,
          reason: null,
        },
      ],
      employee: { name: 'Ravi Kumar' },
    },
  ];

  const prismaMock = {
    employee: { count: jest.fn().mockResolvedValue(24) },
    lead: {
      count: jest.fn().mockResolvedValueOnce(48).mockResolvedValueOnce(10),
      groupBy: jest
        .fn()
        .mockResolvedValue([{ status: 'NEW', _count: { status: 12 } }]),
    },
    task: {
      count: jest.fn().mockResolvedValue(17),
      groupBy: jest
        .fn()
        .mockResolvedValue([{ status: 'OPEN', _count: { status: 9 } }]),
    },
    invoice: {
      count: jest.fn().mockResolvedValue(6),
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 180000 } }),
    },
    attendance: {
      count: jest.fn().mockResolvedValueOnce(35).mockResolvedValueOnce(4),
      groupBy: jest
        .fn()
        .mockResolvedValue([{ status: 'PRESENT', _count: { status: 14 } }]),
    },
    deal: {
      groupBy: jest
        .fn()
        .mockResolvedValue([{ stage: 'WON', _count: { stage: 5 } }]),
      count: jest
        .fn()
        .mockResolvedValueOnce(18)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(2),
      aggregate: jest.fn().mockResolvedValue({ _sum: { value: 900000 } }),
      findMany: jest.fn().mockResolvedValue([
        {
          value: 500000,
          actualCloseDate: new Date('2026-04-10T00:00:00.000Z'),
          closeDate: null,
        },
      ]),
    },
    leaveRequest: {
      count: jest
        .fn()
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1),
      findMany: jest
        .fn()
        .mockResolvedValueOnce(workflowLeaves)
        .mockResolvedValueOnce([]),
    },
    expense: {
      count: jest.fn().mockResolvedValue(4),
      findMany: jest.fn().mockResolvedValue(workflowExpenses),
    },
  };

  const metricsServiceMock = {
    calculateConversionRate: jest.fn().mockReturnValue(38.89),
    calculateAbsenteeism: jest.fn().mockReturnValue(11.43),
    calculateRevenuePerLead: jest.fn().mockReturnValue(3750),
  };

  const cacheManagerMock = {
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MetricsService, useValue: metricsServiceMock },
        { provide: CACHE_MANAGER, useValue: cacheManagerMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: {
          switchToHttp: () => { getRequest: <T>() => T };
        }) {
          const request = context.switchToHttp().getRequest<{
            user?: {
              id: number;
              userId: number;
              email: string;
              name: string;
              role: string;
              roles: string[];
              permissions: string[];
              employeeId: number | null;
              organizationId: number | null;
              tokenType: string;
              jti: string | null;
            };
          }>();
          request.user = {
            id: 1,
            userId: 1,
            email: 'test@example.com',
            name: 'Test User',
            role: 'ADMIN',
            roles: ['ADMIN'],
            permissions: [],
            employeeId: null,
            organizationId: 1,
            tokenType: 'Bearer',
            jti: null,
          };
          return true;
        },
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

  it('returns workflow visibility data in the shared dashboard envelope', async () => {
    await request(app!.getHttpServer())
      .get('/api/v1/dashboard')
      .expect(200)
      .expect(({ body }: { body: unknown }) => {
        const responseBody = body as {
          data: {
            workflow: {
              recentActivity: Array<{
                type: string;
                action: string;
                href: string;
              }>;
            };
          };
        };
        const recentActivity = (
          responseBody.data.workflow as {
            recentActivity: Array<{
              type: string;
              action: string;
              href: string;
            }>;
          }
        ).recentActivity;

        expect(body).toMatchObject({
          success: true,
          message: 'Request successful',
          data: {
            workflow: {
              pendingLeaves: 5,
              pendingExpenses: 4,
            },
          },
        });

        expect(recentActivity[0]).toMatchObject({
          type: 'LEAVE',
          action: 'MANAGER_APPROVED',
          href: '/dashboard/requests',
        });

        expect(recentActivity[1]).toMatchObject({
          type: 'EXPENSE',
          action: 'SUBMITTED',
          href: '/dashboard/expenses',
        });
      });

    expect(cacheManagerMock.set).toHaveBeenCalled();
  });
});
