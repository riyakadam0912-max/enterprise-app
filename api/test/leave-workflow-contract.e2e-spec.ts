import { INestApplication } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LeaveRequestsController } from '../src/leave-requests/leave-requests.controller';
import { LeaveRequestsService } from '../src/leave-requests/leave-requests.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../src/prisma/prisma.service';
import { WorkflowEngineService } from '../src/workflows/workflow-engine.service';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('Leave workflow contract (e2e)', () => {
  let app: INestApplication<App> | undefined;

  const baseLeave = {
    id: 21,
    employeeId: 5,
    startDate: '2026-04-23T00:00:00.000Z',
    endDate: '2026-04-25T00:00:00.000Z',
    leaveType: 'PAID',
    reason: 'Family event',
    status: 'PENDING_MANAGER',
    isPaid: true,
    appliedOn: '2026-04-22T08:00:00.000Z',
    approvedBy: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    approvalTrail: [
      {
        action: 'SUBMITTED',
        at: '2026-04-22T08:00:00.000Z',
        byUserId: 1,
        reason: null,
      },
    ],
    employee: {
      id: 5,
      name: 'Anita Rao',
      user: { id: 5, name: 'Anita Rao', managerId: 10 },
      shiftId: null,
      shift: { requiredHours: 8 },
      leaveBalance: 12,
    },
    createdAt: '2026-04-22T08:00:00.000Z',
    updatedAt: '2026-04-22T08:00:00.000Z',
  };

  let leaveState = clone(baseLeave);

  const prismaMock = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: number } }) => {
        if (where.id === 1) return { id: 1, employeeId: 5 };
        if (where.id === 10) return { name: 'Manager One' };
        return null;
      }),
    },
    employee: {
      findUnique: jest.fn(() => leaveState.employee),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
        ...leaveState.employee,
        ...data,
      })),
    },
    leaveRequest: {
      findFirst: jest.fn(() => leaveState),
      findUnique: jest.fn(() => leaveState),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        leaveState = { ...leaveState, ...data } as typeof leaveState;
        return leaveState;
      }),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    attendance: {
      upsert: jest.fn(() => ({})),
    },
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback(prismaMock as unknown),
    ),
  };

  const cacheManagerMock = {
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const workflowEngineMock = {
    submitWorkflow: jest.fn(),
    approveWorkflow: jest.fn(
      (dto: {
        trail?: Array<Record<string, unknown>>;
        trailAction?: string;
        userId?: number;
        businessStatus?: string;
        approvedByLabel?: string;
      }) => {
        const incomingTrail = Array.isArray(dto.trail) ? dto.trail : [];
        const newTrail = [
          ...incomingTrail,
          {
            action: dto.trailAction,
            at: new Date().toISOString(),
            byUserId: dto.userId,
            reason: null,
          },
        ];
        return {
          workflow: {},
          legacyState: {
            status: dto.businessStatus,
            approvedBy: dto.approvedByLabel,
            approvalTrail: newTrail,
          },
        };
      },
    ),
    rejectWorkflow: jest.fn(
      (dto: {
        trail?: Array<Record<string, unknown>>;
        userId?: number;
        businessStatus?: string;
        approvedByLabel?: string;
        reason?: string;
      }) => {
        const incomingTrail = Array.isArray(dto.trail) ? dto.trail : [];
        const newTrail = [
          ...incomingTrail,
          {
            action: 'REJECTED',
            at: new Date().toISOString(),
            byUserId: dto.userId,
            reason: dto.reason || null,
          },
        ];
        return {
          workflow: {},
          legacyState: {
            status: dto.businessStatus,
            approvedBy: dto.approvedByLabel,
            approvalTrail: newTrail,
            rejectionReason: dto.reason || null,
          },
        };
      },
    ),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [LeaveRequestsController],
      providers: [
        LeaveRequestsService,
        {
          provide: PrismaService,
          useValue: prismaMock as Record<string, unknown>,
        },
        { provide: CACHE_MANAGER, useValue: cacheManagerMock },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: WorkflowEngineService, useValue: workflowEngineMock },
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
          request.user = { userId: 1, role: 'ADMIN', organizationId: 1 };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
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
    leaveState = clone(baseLeave);
    jest.clearAllMocks();
  });

  it('moves a leave request from manager pending to HR pending in the shared envelope', async () => {
    await request(app!.getHttpServer())
      .patch('/api/v1/leave-requests/21/manager-approve')
      .expect(200)
      .expect(({ body }: { body: unknown }) => {
        const responseBody = body as {
          data: {
            approvalTrail: Array<{ action: string; byUserId: number }>;
          };
        };
        const approvalTrail = (
          responseBody.data as {
            approvalTrail: Array<{ action: string; byUserId: number }>;
          }
        ).approvalTrail;

        expect(body).toMatchObject({
          success: true,
          message: 'Request successful',
          data: {
            id: 21,
            status: 'PENDING_HR',
            approvedBy: 'MANAGER:1',
          },
        });

        expect(approvalTrail[approvalTrail.length - 1]).toMatchObject({
          action: 'MANAGER_APPROVED',
          byUserId: 1,
        });
      });
  });

  it('rejects a leave request with a reason in the shared envelope', async () => {
    await request(app!.getHttpServer())
      .patch('/api/v1/leave-requests/21/reject')
      .send({ reason: 'Payroll cutoff passed' })
      .expect(200)
      .expect(({ body }: { body: unknown }) => {
        expect(body).toMatchObject({
          success: true,
          message: 'Request successful',
          data: {
            id: 21,
            status: 'REJECTED',
            approvedBy: 'ADMIN:1 (Rejected)',
            rejectionReason: 'Payroll cutoff passed',
          },
        });
      });
  });
});
