import { INestApplication } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { ExpensesController } from '../src/expenses/expenses.controller';
import { ExpensesService } from '../src/expenses/expenses.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import { WorkflowEngineService } from '../src/workflows/workflow-engine.service';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('Expenses workflow contract (e2e)', () => {
  let app: INestApplication<App> | undefined;

  const baseExpense = {
    id: 11,
    expenseDate: '2026-04-20T00:00:00.000Z',
    category: 'Travel',
    description: 'Client visit',
    amount: 4200,
    currency: 'INR',
    receiptImage: null,
    approvedBy: null,
    status: 'PENDING_MANAGER',
    employeeId: 5,
    submittedByUserId: 1,
    managerApprovalByUserId: null,
    hrApprovalByUserId: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    approvalTrail: [
      {
        action: 'SUBMITTED',
        at: '2026-04-20T08:00:00.000Z',
        byUserId: 1,
        reason: null,
      },
    ],
    createdAt: '2026-04-20T08:00:00.000Z',
    updatedAt: '2026-04-20T08:00:00.000Z',
  };

  let expenseState = clone(baseExpense);

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    expense: {
      findFirst: jest.fn(() => expenseState),
      findUnique: jest.fn(() => expenseState),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        expenseState = {
          ...expenseState,
          ...data,
        };
        return expenseState;
      }),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const cacheManagerMock = {
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  type WorkflowDto = {
    trail?: Array<Record<string, unknown>>;
    trailAction?: string;
    userId?: number;
    businessStatus?: string;
    approvedByLabel?: string;
    reason?: string;
  };

  const workflowEngineMock = {
    submitWorkflow: jest.fn(),
    approveWorkflow: jest.fn((dto: WorkflowDto) => {
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
    }),
    rejectWorkflow: jest.fn((dto: WorkflowDto) => {
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
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [
        ExpensesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManagerMock,
        },
        {
          provide: WorkflowEngineService,
          useValue: workflowEngineMock,
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
    expenseState = clone(baseExpense);
    jest.clearAllMocks();
  });

  it('moves an expense from manager pending to HR pending in the shared envelope', async () => {
    await request(app!.getHttpServer())
      .patch('/api/v1/expenses/11/manager-approve')
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
            id: 11,
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

  it('rejects an expense with a reason in the shared envelope', async () => {
    await request(app!.getHttpServer())
      .patch('/api/v1/expenses/11/reject')
      .send({ reason: 'Missing bill copy' })
      .expect(200)
      .expect(({ body }: { body: unknown }) => {
        expect(body).toMatchObject({
          success: true,
          message: 'Request successful',
          data: {
            id: 11,
            status: 'REJECTED',
            approvedBy: 'ADMIN:1 (Rejected)',
            rejectionReason: 'Missing bill copy',
          },
        });
      });
  });
});
