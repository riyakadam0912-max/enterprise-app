import { Test, type TestingModule } from '@nestjs/testing';
import { TimesheetsService } from '../../src/timesheets/timesheets.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('TimesheetsService project filtering', () => {
  let service: TimesheetsService;
  let prisma: {
    user: { findUnique: jest.Mock };
    timesheet: { findMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 12 }),
      },
      timesheet: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            task: 'Design review',
            project: 'Website rollout',
            projectId: 42,
            taskId: 8,
            date: new Date('2026-01-02T00:00:00.000Z'),
            hours: 4,
            status: 'APPROVED',
            notes: 'Reviewed landing page update',
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimesheetsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(TimesheetsService);
  });

  it('includes projectId and taskId when filtering project-linked timesheets', async () => {
    const result = await service.getReport(
      {
        page: 1,
        limit: 10,
        projectId: '42',
        taskId: '8',
      } as any,
      {
        id: 99,
        userId: 99,
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
        roles: ['ADMIN'],
        permissions: [],
        employeeId: null,
        organizationId: 12,
        tokenType: 'access',
        jti: 'token-1',
      } as any,
    );

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.timesheet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 12,
          projectId: 42,
          taskId: 8,
        }),
      }),
    );
    expect(result.data[0]).toMatchObject({
      projectId: 42,
      taskId: 8,
      project: 'Website rollout',
      task: 'Design review',
    });
  });
});
