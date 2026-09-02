import { ReportsAnalyticsService } from './reports-analytics.service';

describe('ReportsAnalyticsService', () => {
  const prisma: any = {
    attendance: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    employee: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    payrollEntry: {
      aggregate: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    deal: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    performanceReview: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    leaveRequest: {
      count: jest.fn(),
    },
    expense: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    invoice: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
    },
    lead: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    task: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const cacheManager = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };

  let service: ReportsAnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsAnalyticsService(prisma as any, cacheManager as any);
  });

  it('scopes attendance and employee analytics to the active organization', async () => {
    prisma.attendance.count.mockResolvedValue(12);
    prisma.attendance.aggregate.mockResolvedValue({ _sum: { overtimeHours: 0 } });
    prisma.employee.count.mockResolvedValue(8);

    await service.getAttendanceReport(
      {
        userId: 1,
        role: 'ADMIN',
        organizationId: 42,
      } as any,
      {},
    );

    expect(prisma.attendance.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 42,
          employee: expect.objectContaining({ organizationId: 42 }),
        }),
      }),
    );

    await service.getTurnoverSummary(
      {
        userId: 1,
        role: 'ADMIN',
        organizationId: 42,
      } as any,
      {},
    );

    expect(prisma.employee.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 42 }),
      }),
    );
  });
});
