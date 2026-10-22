import { LeaveEntitlementsService } from './leave-entitlements.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { OrganizationScopeService } from '../organizations/organization-scope.service';

describe('LeaveEntitlementsService', () => {
  const leaveBalanceEntry = { findMany: jest.fn() };
  const service = new LeaveEntitlementsService(
    {
      leaveBalanceEntry,
    } as unknown as PrismaService,
    {} as OrganizationScopeService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates paid and unexpired comp-off balances from ledger entries', async () => {
    leaveBalanceEntry.findMany.mockResolvedValue([
      {
        category: 'PAID_LEAVE',
        entryType: 'OPENING_BALANCE',
        amount: 10,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: null,
        periodStart: null,
      },
      {
        category: 'PAID_LEAVE',
        entryType: 'MONTHLY_ACCRUAL',
        amount: 1.5,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        expiresAt: null,
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        category: 'PAID_LEAVE',
        entryType: 'LEAVE_USAGE',
        amount: -0.5,
        createdAt: new Date('2026-02-03T00:00:00.000Z'),
        expiresAt: null,
        periodStart: new Date('2026-01-03T00:00:00.000Z'),
      },
      {
        category: 'COMP_OFF',
        entryType: 'COMPOFF_EARNED',
        amount: 0.5,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2026-03-01T00:00:00.000Z'),
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        category: 'COMP_OFF',
        entryType: 'COMPOFF_EARNED',
        amount: 1,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        expiresAt: new Date('2026-07-01T00:00:00.000Z'),
        periodStart: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    await expect(
      service.getBalance(5, 2, new Date('2026-06-01T00:00:00.000Z')),
    ).resolves.toEqual({
      totalAllocation: 11.5,
      daysTaken: 0.5,
      balance: 11,
      compOffAvailable: 1,
      year: 2026,
    });
  });

  it('checks balance under a transaction lock before recording usage', async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      leaveBalanceEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          {
            amount: 1.5,
            createdAt: new Date('2026-10-01T00:00:00.000Z'),
            expiresAt: null,
          },
        ]),
        create: jest.fn().mockResolvedValue({}),
      },
      employee: { update: jest.fn().mockResolvedValue({}) },
    };

    await service.recordUsage(transaction as never, {
      employeeId: 9,
      organizationId: 3,
      category: 'PAID_LEAVE',
      amount: 0.5,
      sourceKey: 'leave-usage:25',
      sourceId: 25,
      description: 'Approved leave',
      periodStart: new Date('2026-10-12T00:00:00.000Z'),
      periodEnd: new Date('2026-10-12T00:00:00.000Z'),
    });

    const [lockQuery] = transaction.$queryRaw.mock.calls[0];
    expect(lockQuery.join(' ')).toContain('WITH lock_result AS MATERIALIZED');
    expect(lockQuery.join(' ')).toContain('SELECT 1 AS locked');
    expect(transaction.leaveBalanceEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: -0.5,
        entryType: 'LEAVE_USAGE',
        sourceKey: 'leave-usage:25',
      }),
    });
    expect(transaction.employee.update).toHaveBeenCalledWith({
      where: { id: 9, organizationId: 3 },
      data: { leaveBalance: 1 },
    });
  });

  it('credits the monthly accrual and one task-hours bonus at the threshold', async () => {
    const tx = {
      leaveBalanceEntry: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      employee: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      organization: { findMany: jest.fn().mockResolvedValue([{ id: 2 }]) },
      leavePolicy: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([
          {
            organizationId: 2,
            firstAccrualMonth: new Date('2026-11-01T00:00:00.000Z'),
            compOffEffectiveFrom: new Date('2026-10-21T00:00:00.000Z'),
            monthlyPaidLeave: 1.5,
            taskHoursBonusThreshold: 8,
            compOffMinimumHours: 4,
            compOffExpiryDays: 90,
          },
        ]),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([{ id: 31, status: 'ACTIVE' }]),
      },
      timesheet: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ employeeId: 31, _sum: { hours: 8 } }]),
      },
      attendance: { findMany: jest.fn().mockResolvedValue([]) },
      leaveBalanceEntry: { createMany: jest.fn() },
      $transaction: jest.fn(
        async (callback: (transaction: unknown) => unknown) => callback(tx),
      ),
    } as unknown as PrismaService;
    const scheduler = new LeaveEntitlementsService(
      prisma,
      {} as OrganizationScopeService,
    );

    await scheduler.runMonthlyEntitlements(
      new Date('2026-12-01T00:00:00.000Z'),
    );

    expect(tx.leaveBalanceEntry.createMany).toHaveBeenCalledTimes(2);
    expect(tx.leaveBalanceEntry.createMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: [
          expect.objectContaining({
            amount: 1.5,
            sourceKey: 'monthly-accrual:31:2026-11',
          }),
        ],
        skipDuplicates: true,
      }),
    );
    expect(tx.leaveBalanceEntry.createMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: [
          expect.objectContaining({
            amount: 1,
            sourceKey: 'task-hours-bonus:31:2026-11',
          }),
        ],
        skipDuplicates: true,
      }),
    );
    expect(tx.employee.update).toHaveBeenCalledTimes(2);
  });

  it('creates a comp-off claim for qualifying work on a corporate holiday', async () => {
    const attendance = {
      employeeId: 31,
      organizationId: 2,
      date: new Date('2026-10-18T00:00:00.000Z'),
      workingHours: 3,
      taskHours: 1,
      shift: null,
      employee: {
        status: 'ACTIVE',
        deletedAt: null,
        shift: { workingDays: [1, 2, 3, 4, 5] },
      },
    };
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      organization: { findMany: jest.fn().mockResolvedValue([{ id: 2 }]) },
      leavePolicy: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([
          {
            organizationId: 2,
            firstAccrualMonth: new Date('2026-11-01T00:00:00.000Z'),
            compOffEffectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
            monthlyPaidLeave: 1.5,
            taskHoursBonusThreshold: 8,
            compOffMinimumHours: 4,
            compOffExpiryDays: 90,
          },
        ]),
      },
      employee: { findMany: jest.fn().mockResolvedValue([]) },
      timesheet: { groupBy: jest.fn() },
      attendance: { findMany: jest.fn().mockResolvedValue([attendance]) },
      holiday: {
        findMany: jest.fn().mockResolvedValue([
          {
            organizationId: 2,
            familyRootOrganizationId: null,
            startDate: new Date('2026-10-18T00:00:00.000Z'),
            endDate: new Date('2026-10-18T00:00:00.000Z'),
          },
        ]),
      },
      leaveCompOffClaim: { createMany },
    } as unknown as PrismaService;
    const organizationScope = {
      getOrganizationFamilyRootMap: jest
        .fn()
        .mockResolvedValue(new Map([[2, 2]])),
    } as unknown as OrganizationScopeService;
    const scheduler = new LeaveEntitlementsService(prisma, organizationScope);

    await scheduler.runMonthlyEntitlements(
      new Date('2026-10-21T00:00:00.000Z'),
    );

    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          employeeId: 31,
          organizationId: 2,
          workDate: new Date('2026-10-18T00:00:00.000Z'),
          hours: 4,
        }),
      ],
      skipDuplicates: true,
    });
  });
});
