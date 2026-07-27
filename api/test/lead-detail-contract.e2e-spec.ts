import { CacheInterceptor } from '@nestjs/cache-manager';
import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { LeadsController } from '../src/leads/leads.controller';
import { LeadsService } from '../src/leads/leads.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('Lead detail contract (e2e)', () => {
  let app: INestApplication<App> | undefined;

  const leadDetail = {
    lead: {
      id: 7,
      name: 'Asha Verma',
      company: 'Northwind Traders',
      status: 'New',
      createdAt: '2026-04-18T09:30:00.000Z',
      updatedAt: '2026-04-18T09:30:00.000Z',
    },
    activities: [
      {
        id: 91,
        type: 'NOTE',
        description: 'Initial discovery call completed',
        userId: 1,
        leadId: 7,
        dealId: null,
        contactId: null,
        createdAt: '2026-04-20T08:15:00.000Z',
        user: {
          id: 1,
          name: 'Admin User',
          email: 'admin@example.com',
        },
      },
    ],
    tasks: [
      {
        id: 201,
        taskName: 'Send proposal',
        project: 'Northwind Pilot',
        projectId: 31,
        projectRef: {
          id: 31,
          projectName: 'Northwind Pilot',
          managerId: 1,
        },
        assignee: 'Admin User',
        assignedToUserId: 1,
        assignedByUserId: 1,
        assignedToUser: {
          id: 1,
          name: 'Admin User',
          email: 'admin@example.com',
        },
        assignedByUser: {
          id: 1,
          name: 'Admin User',
          email: 'admin@example.com',
        },
        dueDate: '2026-04-25T00:00:00.000Z',
        priority: 'High',
        status: 'PENDING',
        submissionLink: null,
        reviewComment: null,
        estimatedHours: 4,
        actualHours: null,
        notes: 'Prepare proposal draft',
        leadId: 7,
        dealId: null,
        createdAt: '2026-04-20T09:00:00.000Z',
        updatedAt: '2026-04-20T09:00:00.000Z',
      },
    ],
  };

  const leadsService = {
    getDetail: jest.fn().mockResolvedValue(leadDetail),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        {
          provide: LeadsService,
          useValue: leadsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: {
          switchToHttp: () => {
            getRequest: () => Record<string, unknown>;
          };
        }) {
          const request = context.switchToHttp().getRequest();
          request.user = {
            userId: 1,
            role: 'ADMIN',
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

  it('returns a unified lead detail payload in the shared success envelope', async () => {
    await request(app!.getHttpServer())
      .get('/api/v1/leads/7/detail')
      .expect(200)
      .expect({
        success: true,
        message: 'Request successful',
        data: leadDetail,
      });

    expect(leadsService.getDetail).toHaveBeenCalledWith(7, {
      userId: 1,
      role: 'ADMIN',
    });
  });
});
