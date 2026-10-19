import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { AttendanceStatus } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { Role } from '../common/enums/role.enum';
import type { PrismaService } from '../prisma/prisma.service';

function createPrismaMock() {
  const prisma: any = {
    employee: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    employeeShiftAssignment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    shift: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    attendance: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(async (args: any) => {
        const existing = await prisma.attendance.findUnique({
          where: args.where,
          include: args.include,
        });
        if (existing) return existing;
        const created = await prisma.attendance.create({
          data: args.create,
          include: args.include,
        });
        return created ?? { id: -1, ...args.create };
      }),
      create: jest.fn(),
      update: jest.fn(),
    },
    attendanceBreak: {
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    taskTimerSession: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    taskCrewAssignment: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    timesheet: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    taskTimerInterval: { findMany: jest.fn().mockResolvedValue([]) },
    holiday: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    leaveRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback: (transaction: any) => unknown) =>
      callback(prisma),
    ),
  };
  return prisma;
}

function createCacheManagerMock() {
  return {
    del: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  };
}

function createMockUser() {
  return {
    userId: 1,
    role: Role.ADMIN,
    employeeId: 7,
    organizationId: 1,
  };
}

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let cacheManager: ReturnType<typeof createCacheManagerMock>;
  let mockUser: ReturnType<typeof createMockUser>;
  let mockBusinessUnitsService: any;
  let mockOrganizationScopeService: any;
  let mockTasksService: {
    stopAllOpenTimersForUser: jest.Mock;
    stopActiveTimerForEmployee: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    prisma = createPrismaMock();
    cacheManager = createCacheManagerMock();
    mockUser = createMockUser();
    mockBusinessUnitsService = {
      resolveScope: jest.fn().mockResolvedValue({
        organizationId: 1,
        allUnits: true,
        unitIds: [],
        assignedUnitId: null,
      }),
      getEmployeeScopeFilterIds: jest.fn().mockResolvedValue(null),
      buildEmployeeBUWhere: jest
        .fn()
        .mockReturnValue({ organizationId: 1, deletedAt: null }),
    };
    mockOrganizationScopeService = {
      getOrganizationIds: jest.fn().mockResolvedValue([1]),
      getDescendantOrganizationIds: jest.fn(async (id: number) => [id]),
      getOrganizationFamilyRootId: jest.fn(async (id: number) => id),
      getRelatedOrganizationIds: jest.fn(async (id: number) => [id]),
      getOrganizationFamilyRootMap: jest.fn(
        async (ids: number[]) => new Map(ids.map((id) => [id, id])),
      ),
    };
    mockTasksService = {
      stopAllOpenTimersForUser: jest.fn().mockResolvedValue([]),
      stopActiveTimerForEmployee: jest.fn().mockResolvedValue(null),
    };
    service = new AttendanceService(
      prisma as unknown as PrismaService,
      cacheManager as unknown as Cache,
      mockBusinessUnitsService,
      mockOrganizationScopeService as any,
      mockTasksService as any,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('lists shifts created across the current organization family', async () => {
    mockOrganizationScopeService.getRelatedOrganizationIds.mockResolvedValue([
      1, 2, 3,
    ]);
    prisma.shift.findMany.mockResolvedValue([
      {
        id: 12,
        name: 'Parent shift',
        organizationId: 1,
        organization: { name: 'Parent' },
      },
      {
        id: 13,
        name: 'Sibling shift',
        organizationId: 2,
        organization: { name: 'Sibling' },
      },
    ]);

    const result = await service.listShifts({
      ...mockUser,
      organizationId: 3,
    });

    expect(prisma.shift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          deletedAt: null,
          organizationId: { in: [1, 2, 3] },
        },
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 12,
        organizationName: 'Parent',
        canManage: false,
      }),
      expect.objectContaining({
        id: 13,
        organizationName: 'Sibling',
        canManage: false,
      }),
    ]);
  });

  it('allows a super admin to assign a family shift to an employee in the selected organization', async () => {
    const superAdmin = {
      ...mockUser,
      role: Role.SUPER_ADMIN,
      organizationId: 2,
    };
    mockBusinessUnitsService.buildEmployeeBUWhere.mockReturnValue({
      organizationId: 2,
      deletedAt: null,
    });
    mockOrganizationScopeService.getRelatedOrganizationIds.mockResolvedValue([
      1, 2,
    ]);
    mockOrganizationScopeService.getOrganizationFamilyRootId.mockResolvedValue(
      1,
    );
    prisma.shift.findFirst.mockResolvedValue({
      id: 12,
      type: 'FIXED',
      requiredHours: 8,
      organizationId: 1,
      isActive: true,
    });
    prisma.employee.findFirst.mockResolvedValue({
      id: 25,
      organizationId: 2,
    });
    prisma.employee.update.mockResolvedValue({
      id: 25,
      shiftId: 12,
    });

    const result = await service.assignShift(
      { employeeId: 25, shiftId: 12 },
      superAdmin,
    );

    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 25, organizationId: 2 },
        data: { shiftId: 12 },
      }),
    );
    expect(prisma.employeeShiftAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 25,
        shiftId: 12,
        effectiveFrom: expect.any(Date),
      }),
    });
    expect(result).toEqual({ id: 25, shiftId: 12 });
  });

  it('rejects assigning a shift from a different organization family', async () => {
    const superAdmin = {
      ...mockUser,
      role: Role.SUPER_ADMIN,
      organizationId: 2,
    };
    mockBusinessUnitsService.buildEmployeeBUWhere.mockReturnValue({
      organizationId: 2,
      deletedAt: null,
    });
    mockOrganizationScopeService.getRelatedOrganizationIds.mockResolvedValue([
      1, 2,
    ]);
    mockOrganizationScopeService.getOrganizationFamilyRootId
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(9);
    prisma.shift.findFirst.mockResolvedValue({
      id: 12,
      organizationId: 1,
      isActive: true,
    });
    prisma.employee.findFirst.mockResolvedValue({
      id: 25,
      organizationId: 2,
    });

    await expect(
      service.assignShift({ employeeId: 25, shiftId: 12 }, superAdmin),
    ).rejects.toThrow(
      'The shift and employee must belong to the same organization family',
    );
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('summarizes task and attendance time using the organization-local day', async () => {
    jest.setSystemTime(new Date('2026-10-16T05:00:00.000Z'));
    const employee = {
      id: 7,
      organizationId: 1,
      shift: { requiredHours: 8 },
    };
    prisma.employee.findFirst
      .mockResolvedValueOnce({ id: 7 })
      .mockResolvedValueOnce(employee);
    prisma.organization.findUnique.mockResolvedValueOnce({
      timezone: 'Asia/Kolkata',
    });
    prisma.taskTimerInterval.findMany.mockResolvedValueOnce([
      {
        startedAt: new Date('2026-10-15T23:00:00.000Z'),
        endedAt: new Date('2026-10-16T01:00:00.000Z'),
      },
    ]);
    prisma.taskTimerSession.findFirst.mockResolvedValueOnce({
      startedAt: new Date('2026-10-16T04:00:00.000Z'),
      task: { taskName: 'Prepare campaign assets' },
    });
    prisma.timesheet.findMany.mockResolvedValueOnce([
      { hours: 1.5 },
      { hours: 0.5 },
    ]);
    prisma.attendance.findUnique.mockResolvedValueOnce({
      checkIn: new Date('2026-10-16T00:00:00.000Z'),
      checkOut: null,
      requiredHours: null,
      shift: { requiredHours: 8 },
      breaks: [
        {
          startedAt: new Date('2026-10-16T02:00:00.000Z'),
          endedAt: new Date('2026-10-16T02:30:00.000Z'),
        },
      ],
    });

    const result = await service.getMyTaskWorkSummary(mockUser);

    expect(result).toEqual({
      date: '2026-10-16',
      taskTrackedSeconds: 10_800,
      taskTimesheetSeconds: 7_200,
      taskWorkSeconds: 18_000,
      attendanceWorkedSeconds: 16_200,
      scheduledSeconds: 28_800,
      activeTimer: {
        taskName: 'Prepare campaign assets',
        startedAt: '2026-10-16T04:00:00.000Z',
      },
    });
    expect(prisma.taskTimerInterval.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startedAt: { lt: new Date('2026-10-16T05:00:00.000Z') },
          endedAt: { gt: new Date('2026-10-15T18:30:00.000Z') },
        }),
      }),
    );
    expect(prisma.timesheet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 7,
          organizationId: 1,
          status: { not: 'REJECTED' },
          source: { not: 'TASK_TIMER' },
          deletedAt: null,
        }),
      }),
    );
  });

  it('returns paginated recent attendance history for the linked employee', async () => {
    jest.setSystemTime(new Date('2026-10-19T12:00:00.000Z'));
    prisma.employee.findFirst.mockResolvedValueOnce({ id: 7 });
    prisma.organization.findUnique.mockResolvedValueOnce({ timezone: 'UTC' });
    prisma.attendance.findMany.mockResolvedValueOnce([
      {
        id: 42,
        employeeId: 7,
        employee: {
          id: 7,
          name: 'Ava',
          department: 'Ops',
          designation: 'Coordinator',
        },
        date: new Date('2026-10-18T00:00:00.000Z'),
        checkIn: new Date('2026-10-18T09:00:00.000Z'),
        checkOut: new Date('2026-10-18T17:00:00.000Z'),
        checkoutSource: 'USER',
        workingHours: 7.5,
        taskHours: 1,
        lateMinutes: 0,
        overtimeHours: 0,
        shortfallHours: 0,
        requiredHours: 8,
        status: AttendanceStatus.PRESENT,
        isShootDay: false,
        shift: {
          id: 3,
          name: 'Day',
          type: 'FIXED',
          startTime: '09:00',
          endTime: '17:00',
          requiredHours: 8,
          minPresentHours: 5,
          gracePeriodMinutes: 15,
          weeklyHolidayDay: 0,
          workingDays: [1, 2, 3, 4, 5],
        },
        breaks: [
          {
            startedAt: new Date('2026-10-18T12:00:00.000Z'),
            endedAt: new Date('2026-10-18T12:30:00.000Z'),
          },
        ],
      },
    ]);
    prisma.attendance.count.mockResolvedValueOnce(13);

    const result = await service.getMyAttendanceHistory(
      { fromDate: '2026-09-20', page: 2, limit: 10 },
      mockUser,
    );

    expect(result).toEqual(
      expect.objectContaining({
        total: 13,
        page: 2,
        limit: 10,
        data: [
          expect.objectContaining({
            id: 42,
            employeeId: 7,
            taskHours: 1,
            breakHours: 0.5,
            shiftDetails: expect.objectContaining({ type: 'FIXED' }),
          }),
        ],
      }),
    );
    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 7,
          organizationId: 1,
          deletedAt: null,
          date: {
            gte: new Date('2026-09-20T00:00:00.000Z'),
            lte: new Date('2026-10-19T00:00:00.000Z'),
          },
        }),
        skip: 10,
        take: 10,
        orderBy: { date: 'desc' },
      }),
    );
  });

  it('defaults attendance history to 30 days and supports all history', async () => {
    jest.setSystemTime(new Date('2026-10-19T12:00:00.000Z'));
    prisma.employee.findFirst.mockResolvedValue({ id: 7 });
    prisma.organization.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.count.mockResolvedValue(0);

    await service.getMyAttendanceHistory({ page: 1, limit: 10 }, mockUser);
    await service.getMyAttendanceHistory(
      { page: 1, limit: 10, all: true },
      mockUser,
    );

    expect(prisma.attendance.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date('2026-09-20T00:00:00.000Z'),
            lte: new Date('2026-10-19T00:00:00.000Z'),
          },
        }),
      }),
    );
    expect(prisma.attendance.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.not.objectContaining({ date: expect.anything() }),
      }),
    );
  });

  it('summarizes daily attendance after applying status filters', async () => {
    jest.spyOn(service as any, 'buildDailySnapshot').mockResolvedValue({
      rows: [
        { status: AttendanceStatus.PRESENT, employee: { department: 'Sales' } },
        { status: AttendanceStatus.ABSENT, employee: { department: 'Sales' } },
      ],
      summary: { present: 1, absent: 1, leave: 0, halfDay: 0 },
    });

    const result = await service.findAll(
      { status: AttendanceStatus.PRESENT, page: 1, limit: 10 },
      mockUser as any,
    );

    expect(result.total).toBe(1);
    expect(result.summary.present).toBe(1);
    expect(result.summary.absent).toBe(0);
  });

  it('uses the organization timezone when resolving today without a date', async () => {
    jest.setSystemTime(new Date('2026-03-12T19:00:00.000Z'));
    prisma.organization.findUnique.mockResolvedValue({
      timezone: 'Asia/Kolkata',
    });
    jest.spyOn(service as any, 'buildDailySnapshot').mockResolvedValue({
      rows: [],
      summary: {},
    });

    await service.getToday(mockUser);

    expect((service as any).buildDailySnapshot).toHaveBeenCalledWith(
      new Date('2026-03-13T00:00:00.000Z'),
      null,
      expect.any(Object),
    );
  });

  it('shows an active flexible break from an earlier attendance date in today status', async () => {
    prisma.organization.findUnique.mockResolvedValue({ timezone: 'UTC' });
    jest.spyOn(service as any, 'buildDailySnapshot').mockResolvedValue({
      rows: [
        {
          employeeId: 7,
          shiftDetails: { type: 'FLEXIBLE' },
          onBreak: false,
        },
      ],
      summary: {},
    });
    prisma.attendance.findMany.mockResolvedValue([{ employeeId: 7 }]);

    const result = await service.getToday(mockUser);

    expect(prisma.attendance.findMany).toHaveBeenCalledWith({
      where: {
        employeeId: { in: [7] },
        breaks: { some: { endedAt: null } },
      },
      select: { employeeId: true },
    });
    expect(result.rows[0].onBreak).toBe(true);
  });

  it('returns an already-checked-out conflict for a stale checkout request', async () => {
    jest.setSystemTime(new Date('2026-03-14T00:01:00.000Z'));
    jest.spyOn(service as any, 'resolveScopedEmployeeId').mockResolvedValue(7);
    jest.spyOn(service as any, 'ensureEmployee').mockResolvedValue({
      id: 7,
      organizationId: 1,
      shift: null,
    });
    prisma.attendance.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 91,
        checkIn: new Date('2026-03-13T09:00:00.000Z'),
        checkOut: new Date('2026-03-14T00:00:00.000Z'),
      });

    await expect(service.checkOut({}, mockUser)).rejects.toThrow(
      'Employee has already checked out',
    );
  });

  it('replaces edited breaks atomically and recalculates net worked hours', async () => {
    const checkIn = new Date('2026-10-06T09:00:00.000Z');
    const checkOut = new Date('2026-10-06T18:00:00.000Z');
    const breakStart = new Date('2026-10-06T13:00:00.000Z');
    const breakEnd = new Date('2026-10-06T14:00:00.000Z');
    prisma.attendance.findFirst.mockResolvedValue({
      id: 44,
      employeeId: 7,
      organizationId: 1,
      date: new Date('2026-10-06T00:00:00.000Z'),
      checkIn,
      checkOut,
      status: AttendanceStatus.PRESENT,
      breaks: [],
      employee: { hireDate: null, shift: null },
      shift: null,
    });
    prisma.organization.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.attendance.update.mockResolvedValue({ id: 44 });
    jest.spyOn(service as any, 'calculateLateMinutes').mockReturnValue(0);
    jest
      .spyOn(service as any, 'findApprovedLeaveForDay')
      .mockResolvedValue(null);

    await service.update(
      44,
      {
        breaks: [
          {
            startedAt: breakStart.toISOString(),
            endedAt: breakEnd.toISOString(),
          },
        ],
      } as any,
      mockUser as any,
    );

    expect(prisma.attendanceBreak.deleteMany).toHaveBeenCalledWith({
      where: { attendanceId: 44 },
    });
    expect(prisma.attendanceBreak.createMany).toHaveBeenCalledWith({
      data: [{ attendanceId: 44, startedAt: breakStart, endedAt: breakEnd }],
    });
    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 44, organizationId: 1 },
        data: expect.objectContaining({ workingHours: 8 }),
        include: expect.objectContaining({ breaks: true }),
      }),
    );
  });

  it('allows a super admin to edit attendance in the selected organization', async () => {
    prisma.attendance.findFirst.mockResolvedValue({
      id: 48,
      employeeId: 7,
      organizationId: 42,
      date: new Date('2026-10-06T00:00:00.000Z'),
      checkIn: new Date('2026-10-06T09:00:00.000Z'),
      checkOut: new Date('2026-10-06T18:00:00.000Z'),
      status: AttendanceStatus.PRESENT,
      breaks: [],
      employee: { hireDate: null, shift: null },
      shift: null,
    });
    prisma.organization.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.attendance.update.mockResolvedValue({ id: 48 });
    jest.spyOn(service as any, 'calculateLateMinutes').mockReturnValue(0);
    jest
      .spyOn(service as any, 'findApprovedLeaveForDay')
      .mockResolvedValue(null);

    await service.update(
      48,
      { status: AttendanceStatus.PRESENT } as any,
      { ...mockUser, role: Role.SUPER_ADMIN, organizationId: 1 } as any,
    );

    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 48, organizationId: 42 },
      }),
    );
  });

  it('preserves and subtracts existing breaks when only attendance fields are edited', async () => {
    prisma.attendance.findFirst.mockResolvedValue({
      id: 45,
      employeeId: 7,
      organizationId: 1,
      date: new Date('2026-10-06T00:00:00.000Z'),
      checkIn: new Date('2026-10-06T09:00:00.000Z'),
      checkOut: new Date('2026-10-06T18:00:00.000Z'),
      status: AttendanceStatus.PRESENT,
      breaks: [
        {
          id: 2,
          startedAt: new Date('2026-10-06T13:00:00.000Z'),
          endedAt: new Date('2026-10-06T14:00:00.000Z'),
        },
      ],
      employee: { hireDate: null, shift: null },
      shift: null,
    });
    prisma.organization.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.attendance.update.mockResolvedValue({ id: 45 });
    jest.spyOn(service as any, 'calculateLateMinutes').mockReturnValue(0);
    jest
      .spyOn(service as any, 'findApprovedLeaveForDay')
      .mockResolvedValue(null);

    await service.update(
      45,
      { status: AttendanceStatus.PRESENT } as any,
      mockUser as any,
    );

    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workingHours: 8 }),
      }),
    );
    expect(prisma.attendanceBreak.deleteMany).not.toHaveBeenCalled();
  });

  it('moves existing breaks with the attendance date when the date is changed', async () => {
    prisma.attendance.findFirst.mockResolvedValue({
      id: 47,
      employeeId: 7,
      organizationId: 1,
      date: new Date('2026-10-06T00:00:00.000Z'),
      checkIn: new Date('2026-10-06T09:00:00.000Z'),
      checkOut: new Date('2026-10-06T18:00:00.000Z'),
      status: AttendanceStatus.PRESENT,
      breaks: [
        {
          id: 3,
          startedAt: new Date('2026-10-06T13:00:00.000Z'),
          endedAt: new Date('2026-10-06T14:00:00.000Z'),
        },
      ],
      employee: { hireDate: null, shift: null },
      shift: null,
    });
    prisma.organization.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.attendance.update.mockResolvedValue({ id: 47 });
    jest.spyOn(service as any, 'calculateLateMinutes').mockReturnValue(0);
    jest
      .spyOn(service as any, 'findApprovedLeaveForDay')
      .mockResolvedValue(null);

    await service.update(
      47,
      {
        date: '2026-10-07',
        checkIn: '2026-10-07T09:00:00.000Z',
        checkOut: '2026-10-07T18:00:00.000Z',
        status: AttendanceStatus.PRESENT,
      } as any,
      mockUser as any,
    );

    expect(prisma.attendanceBreak.createMany).toHaveBeenCalledWith({
      data: [
        {
          attendanceId: 47,
          startedAt: new Date('2026-10-07T13:00:00.000Z'),
          endedAt: new Date('2026-10-07T14:00:00.000Z'),
        },
      ],
    });
    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workingHours: 8 }),
      }),
    );
  });

  it.each([
    {
      reason: 'overlapping intervals',
      breaks: [
        {
          startedAt: '2026-10-06T12:00:00.000Z',
          endedAt: '2026-10-06T13:30:00.000Z',
        },
        {
          startedAt: '2026-10-06T13:00:00.000Z',
          endedAt: '2026-10-06T14:00:00.000Z',
        },
      ],
      message: 'Break intervals cannot overlap',
    },
    {
      reason: 'intervals outside the attendance span',
      breaks: [
        {
          startedAt: '2026-10-06T18:00:00.000Z',
          endedAt: '2026-10-06T18:30:00.000Z',
        },
      ],
      message: 'Breaks must fall within check-in and check-out',
    },
  ])(
    'rejects $reason without writing attendance',
    async ({ breaks, message }) => {
      prisma.attendance.findFirst.mockResolvedValue({
        id: 46,
        employeeId: 7,
        organizationId: 1,
        date: new Date('2026-10-06T00:00:00.000Z'),
        checkIn: new Date('2026-10-06T09:00:00.000Z'),
        checkOut: new Date('2026-10-06T18:00:00.000Z'),
        status: AttendanceStatus.PRESENT,
        breaks: [],
        employee: { hireDate: null, shift: null },
        shift: null,
      });

      await expect(
        service.update(46, { breaks } as any, mockUser as any),
      ).rejects.toThrow(message);

      expect(prisma.attendanceBreak.deleteMany).not.toHaveBeenCalled();
      expect(prisma.attendance.update).not.toHaveBeenCalled();
    },
  );

  it('allows a super admin to create a holiday for the active organization', async () => {
    prisma.holiday.create.mockResolvedValue({
      id: 3,
      organizationId: 42,
      startDate: new Date('2026-10-02T00:00:00.000Z'),
      endDate: new Date('2026-10-03T00:00:00.000Z'),
      name: 'Founders Day',
    });

    const result = await service.createHoliday(
      {
        startDate: '2026-10-02',
        endDate: '2026-10-03',
        name: ' Founders Day ',
      },
      { ...mockUser, role: Role.SUPER_ADMIN, organizationId: 42 },
    );

    expect(prisma.holiday.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { organizationId: { in: [42] } },
            { familyRootOrganizationId: 42 },
          ],
          startDate: { lte: new Date('2026-10-03T00:00:00.000Z') },
          endDate: { gte: new Date('2026-10-02T00:00:00.000Z') },
        }),
      }),
    );
    expect(prisma.holiday.create).toHaveBeenCalledWith({
      data: {
        organizationId: 42,
        familyRootOrganizationId: null,
        startDate: new Date('2026-10-02T00:00:00.000Z'),
        endDate: new Date('2026-10-03T00:00:00.000Z'),
        name: 'Founders Day',
      },
    });
    expect(result.name).toBe('Founders Day');
  });

  it('rejects overlapping corporate holiday ranges', async () => {
    prisma.holiday.findFirst.mockResolvedValue({ id: 8 });

    await expect(
      service.createHoliday(
        {
          startDate: '2026-10-03',
          endDate: '2026-10-05',
          name: 'Festival break',
        },
        { ...mockUser, role: Role.ADMIN },
      ),
    ).rejects.toThrow('This holiday range overlaps another corporate holiday');

    expect(prisma.holiday.create).not.toHaveBeenCalled();
  });

  it('allows an employee to check in once per day', async () => {
    jest.setSystemTime(new Date('2026-03-13T09:00:00.000Z'));
    const mockEmployee = {
      id: 7,
      name: 'Ava',
      shift: {
        id: 1,
        name: 'Day',
        type: 'FIXED',
        startTime: '09:00',
        endTime: '17:00',
        requiredHours: 8,
        gracePeriodMinutes: 15,
      },
    };
    prisma.employee.findFirst.mockResolvedValue(mockEmployee);
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.leaveRequest.findFirst.mockResolvedValue(null);
    prisma.attendance.create.mockResolvedValue({
      id: 1,
      employeeId: 7,
      status: AttendanceStatus.PRESENT,
      employee: mockEmployee,
      shift: mockEmployee.shift,
    });

    const result = await service.checkIn(
      {
        employeeId: 7,
        date: '2026-03-13',
        timestamp: '2026-03-13T09:00:00.000Z',
      },
      mockUser,
    );

    expect(result).toEqual({
      id: 1,
      employeeId: 7,
      status: AttendanceStatus.PRESENT,
      employee: mockEmployee,
      shift: mockEmployee.shift,
    });
    expect(prisma.attendance.create).toHaveBeenCalledTimes(1);
    expect(prisma.leaveRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ duration: 'FULL_DAY' }),
      }),
    );
  });

  it('uses the half-day five-hour target for attendance shortfall', () => {
    expect(
      (service as any).calculateShortfallHours(5, { requiredHours: 8 }, 5),
    ).toBe(0);
  });

  it('rejects client-supplied attendance dates for employee actions', () => {
    expect(() =>
      (service as any).resolveAttendanceActionTime(
        '2026-10-17',
        '2026-10-17T09:00:00.000Z',
        { ...mockUser, role: Role.EMPLOYEE },
        'UTC',
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects future admin attendance timestamps', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(() =>
      (service as any).resolveAttendanceActionTime(
        undefined,
        future,
        mockUser,
        'UTC',
      ),
    ).toThrow(BadRequestException);
  });

  it('uses effective-dated shift assignment rather than the current shift for historical days', () => {
    const fixedShift = { id: 1, type: 'FIXED' };
    const flexibleShift = { id: 2, type: 'FLEXIBLE' };
    const assignments = [
      {
        effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-10-10T00:00:00.000Z'),
        shift: fixedShift,
      },
      {
        effectiveFrom: new Date('2026-10-10T00:00:00.000Z'),
        effectiveTo: null,
        shift: flexibleShift,
      },
    ];

    expect(
      (service as any).employeeShiftForDay(
        assignments,
        flexibleShift,
        new Date('2026-10-05T00:00:00.000Z'),
      ),
    ).toEqual(fixedShift);
    expect(
      (service as any).employeeShiftForDay(
        assignments,
        flexibleShift,
        new Date('2026-10-17T00:00:00.000Z'),
      ),
    ).toEqual(flexibleShift);
  });

  it('allows Sunday catch-up check-in while work hours remain outstanding', async () => {
    jest.setSystemTime(new Date('2026-03-15T09:00:00.000Z'));
    const employee = {
      id: 7,
      organizationId: 1,
      name: 'Ava',
      shift: {
        id: 1,
        name: 'Day',
        type: 'FIXED',
        startTime: '09:00',
        endTime: '18:00',
        requiredHours: 8,
        minPresentHours: 5,
        gracePeriodMinutes: 15,
        weeklyHolidayDay: 0,
      },
    };
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.leaveRequest.findFirst.mockResolvedValue(null);
    prisma.organization.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.attendance.create.mockResolvedValue({
      id: 3,
      status: AttendanceStatus.PRESENT,
    });
    jest
      .spyOn(service as any, 'getWorkHourBalancesForEmployee')
      .mockResolvedValue({
        week: { remainingHours: 2 },
        month: { remainingHours: 4 },
      });

    await service.checkIn(
      {
        employeeId: 7,
        date: '2026-03-15',
        timestamp: '2026-03-15T09:00:00.000Z',
      },
      mockUser,
    );

    expect(prisma.attendance.create).toHaveBeenCalledTimes(1);
  });

  it('rejects Sunday catch-up check-in when weekly and monthly targets are complete', async () => {
    jest.setSystemTime(new Date('2026-03-15T09:00:00.000Z'));
    const employee = {
      id: 7,
      organizationId: 1,
      name: 'Ava',
      shift: {
        id: 1,
        name: 'Day',
        type: 'FIXED',
        startTime: '09:00',
        endTime: '18:00',
        requiredHours: 8,
        minPresentHours: 5,
        gracePeriodMinutes: 15,
        weeklyHolidayDay: 0,
      },
    };
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.leaveRequest.findFirst.mockResolvedValue(null);
    prisma.organization.findUnique.mockResolvedValue({ timezone: 'UTC' });
    jest
      .spyOn(service as any, 'getWorkHourBalancesForEmployee')
      .mockResolvedValue({
        week: { remainingHours: 0 },
        month: { remainingHours: 0 },
      });

    await expect(
      service.checkIn(
        {
          employeeId: 7,
          date: '2026-03-15',
          timestamp: '2026-03-15T09:00:00.000Z',
        },
        mockUser,
      ),
    ).rejects.toThrow(
      'catch-up is available only when scheduled hours are outstanding',
    );

    expect(prisma.attendance.create).not.toHaveBeenCalled();
  });

  it('records late minutes using the organization timezone and includes them in the late count', async () => {
    jest.setSystemTime(new Date('2026-03-13T03:46:00.000Z'));
    const employee = {
      id: 7,
      name: 'Ava',
      organizationId: 1,
      shift: {
        id: 1,
        name: 'Day',
        type: 'FIXED',
        startTime: '09:00',
        endTime: '17:00',
        requiredHours: 8,
        minPresentHours: 5,
        gracePeriodMinutes: 15,
        weeklyHolidayDay: 0,
      },
    };
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.organization.findUnique.mockResolvedValue({
      timezone: 'Asia/Kolkata',
    });
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.leaveRequest.findFirst.mockResolvedValue(null);
    prisma.attendance.create.mockResolvedValue({
      id: 11,
      employeeId: 7,
      lateMinutes: 1,
      status: AttendanceStatus.PRESENT,
    });

    const result = await service.checkIn(
      {
        employeeId: 7,
        date: '2026-03-13',
        timestamp: '2026-03-13T03:46:00.000Z',
      },
      mockUser,
    );

    expect(prisma.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          date: new Date('2026-03-13T00:00:00.000Z'),
          lateMinutes: 1,
        }),
      }),
    );
    expect(
      (service as any).buildSummary([
        { status: AttendanceStatus.PRESENT, lateMinutes: result.lateMinutes },
      ]).lateCount,
    ).toBe(1);
  });

  it('rejects duplicate check-in attempts on the same day', async () => {
    const mockEmployee = {
      id: 7,
      name: 'Ava',
      shift: {
        id: 1,
        name: 'Day',
        type: 'FIXED',
        startTime: '09:00',
        endTime: '17:00',
        requiredHours: 8,
        gracePeriodMinutes: 15,
      },
    };
    prisma.employee.findFirst.mockResolvedValue(mockEmployee);
    prisma.attendance.findUnique.mockResolvedValue({
      id: 10,
      employeeId: 7,
      checkIn: new Date('2026-03-13T09:00:00.000Z'),
      shift: mockEmployee.shift,
    });

    await expect(
      service.checkIn({ employeeId: 7, date: '2026-03-13' }, mockUser),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.attendance.create).not.toHaveBeenCalled();
  });

  it('updates working hours and status on check-out', async () => {
    jest.setSystemTime(new Date('2026-03-13T14:00:00.000Z'));
    const mockEmployee = {
      id: 7,
      name: 'Ava',
      shift: {
        id: 1,
        name: 'Day',
        type: 'FIXED',
        startTime: '09:00',
        endTime: '17:00',
        requiredHours: 8,
        gracePeriodMinutes: 15,
      },
    };
    prisma.employee.findFirst.mockResolvedValue(mockEmployee);
    prisma.attendance.findUnique.mockResolvedValue({
      id: 10,
      employeeId: 7,
      date: new Date('2026-03-13T00:00:00.000Z'),
      checkIn: new Date('2026-03-13T09:00:00.000Z'),
      checkOut: null,
      workingHours: null,
      status: AttendanceStatus.PRESENT,
      shift: mockEmployee.shift,
    });
    prisma.attendance.update.mockResolvedValue({
      id: 10,
      employeeId: 7,
      workingHours: 5,
      status: AttendanceStatus.PRESENT,
      employee: mockEmployee,
      shift: mockEmployee.shift,
    });

    const result = await service.checkOut(
      {
        employeeId: 7,
        date: '2026-03-13',
        timestamp: '2026-03-13T14:00:00.000Z',
      },
      mockUser,
    );

    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workingHours: 5,
          checkoutSource: 'USER',
          checkoutActorId: mockUser.userId,
        }),
      }),
    );
    expect(mockTasksService.stopActiveTimerForEmployee).toHaveBeenCalledWith(
      7,
      1,
      new Date('2026-03-13T14:00:00.000Z'),
      prisma,
    );
    expect(result).toEqual({
      id: 10,
      employeeId: 7,
      workingHours: 5,
      status: AttendanceStatus.PRESENT,
      employee: mockEmployee,
      shift: mockEmployee.shift,
    });
  });

  it('credits flexible attendance hours when no task timer was recorded that day', async () => {
    jest.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
    const employee = {
      id: 7,
      organizationId: 1,
      shift: { type: 'FLEXIBLE', requiredHours: 8 },
    };
    prisma.employee.findFirst
      .mockResolvedValueOnce({ id: 7 })
      .mockResolvedValueOnce(employee);
    prisma.organization.findUnique.mockResolvedValueOnce({ timezone: 'UTC' });
    prisma.taskTimerInterval.findMany.mockResolvedValueOnce([]);
    prisma.taskTimerSession.findFirst.mockResolvedValueOnce(null);
    prisma.attendance.findUnique.mockResolvedValueOnce({
      date: new Date('2026-10-16T00:00:00.000Z'),
      checkIn: new Date('2026-10-16T08:00:00.000Z'),
      checkOut: new Date('2026-10-16T12:00:00.000Z'),
      requiredHours: 8,
      shift: { requiredHours: 8 },
      breaks: [
        {
          startedAt: new Date('2026-10-16T10:00:00.000Z'),
          endedAt: new Date('2026-10-16T10:30:00.000Z'),
        },
      ],
    });

    const result = await service.getMyTaskWorkSummary(mockUser);

    expect(result).toEqual(
      expect.objectContaining({
        taskTrackedSeconds: 0,
        attendanceWorkedSeconds: 12_600,
        creditedWorkSeconds: 12_600,
        legacyAttendanceSeconds: 12_600,
        workingDayEquivalent: 0.44,
      }),
    );
  });

  it('does not write checkout when the timer cannot be finalized', async () => {
    jest.setSystemTime(new Date('2026-03-13T14:00:00.000Z'));
    const mockEmployee = {
      id: 7,
      organizationId: 1,
      name: 'Ava',
      shift: {
        id: 1,
        name: 'Day',
        type: 'FIXED',
        startTime: '09:00',
        endTime: '17:00',
        requiredHours: 8,
        gracePeriodMinutes: 15,
      },
    };
    prisma.employee.findFirst.mockResolvedValue(mockEmployee);
    prisma.attendance.findUnique.mockResolvedValue({
      id: 10,
      employeeId: 7,
      date: new Date('2026-03-13T00:00:00.000Z'),
      checkIn: new Date('2026-03-13T09:00:00.000Z'),
      checkOut: null,
      status: AttendanceStatus.PRESENT,
      shift: mockEmployee.shift,
      breaks: [],
    });
    mockTasksService.stopActiveTimerForEmployee.mockRejectedValueOnce(
      new Error('timer write failed'),
    );

    await expect(
      service.checkOut(
        {
          employeeId: 7,
          date: '2026-03-13',
          timestamp: '2026-03-13T14:00:00.000Z',
        },
        mockUser,
      ),
    ).rejects.toThrow('timer write failed');
    expect(prisma.attendance.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('starts a break for an active attendance record', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 7 });
    prisma.attendance.findFirst.mockResolvedValue({ id: 10, breaks: [] });
    prisma.attendanceBreak.create.mockResolvedValue({
      id: 1,
      attendanceId: 10,
      startedAt: new Date('2026-03-13T12:00:00.000Z'),
      endedAt: null,
    });

    const result = await service.startBreak(mockUser);

    expect(prisma.attendanceBreak.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ attendanceId: 10 }),
    });
    expect(mockTasksService.stopAllOpenTimersForUser).toHaveBeenCalledWith(
      mockUser,
      expect.any(Date),
      prisma,
    );
    expect(result.onBreak).toBe(true);
  });

  it('starts a flexible break without check-in by creating a not-started attendance shell', async () => {
    prisma.employee.findFirst
      .mockResolvedValueOnce({ id: 7 })
      .mockResolvedValueOnce({
        id: 7,
        organizationId: 1,
        shift: {
          id: 4,
          type: 'FLEXIBLE',
          requiredHours: 8,
        },
      });
    prisma.organization.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.attendance.create.mockResolvedValue({ id: 10, breaks: [] });
    prisma.attendanceBreak.create.mockResolvedValue({
      id: 1,
      attendanceId: 10,
      startedAt: new Date('2026-03-13T12:00:00.000Z'),
      endedAt: null,
    });

    const result = await service.startBreak(mockUser);

    expect(prisma.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeId: 7,
          status: AttendanceStatus.NOT_STARTED,
        }),
      }),
    );
    expect(prisma.attendanceBreak.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ attendanceId: 10 }),
    });
    expect(result.onBreak).toBe(true);
  });

  it('does not create a break when stopping the task timer fails', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 7 });
    prisma.attendance.findFirst.mockResolvedValue({ id: 10, breaks: [] });
    mockTasksService.stopAllOpenTimersForUser.mockRejectedValueOnce(
      new Error('timer write failed'),
    );

    await expect(service.startBreak(mockUser)).rejects.toThrow(
      'timer write failed',
    );
    expect(prisma.attendanceBreak.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects starting a second active break', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 7 });
    prisma.attendance.findFirst.mockResolvedValue({
      id: 10,
      breaks: [{ id: 1, startedAt: new Date(), endedAt: null }],
    });

    await expect(service.startBreak(mockUser)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.attendanceBreak.create).not.toHaveBeenCalled();
  });

  it('stops the active break', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 7 });
    prisma.attendance.findFirst.mockResolvedValue({
      id: 10,
      breaks: [{ id: 1, startedAt: new Date(), endedAt: null }],
    });
    prisma.attendanceBreak.update.mockResolvedValue({
      id: 1,
      attendanceId: 10,
      startedAt: new Date('2026-03-13T12:00:00.000Z'),
      endedAt: new Date('2026-03-13T12:30:00.000Z'),
    });

    const result = await service.stopBreak(mockUser);

    expect(prisma.attendanceBreak.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { endedAt: expect.any(Date) },
      }),
    );
    expect(result.onBreak).toBe(false);
  });

  it('closes all outstanding flexible breaks so stale intervals cannot block timers', async () => {
    prisma.employee.findFirst
      .mockResolvedValueOnce({ id: 7 })
      .mockResolvedValueOnce({
        id: 7,
        organizationId: 1,
        shift: { type: 'FLEXIBLE' },
      });
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 11,
        breaks: [
          { id: 21, attendanceId: 11, startedAt: new Date(), endedAt: null },
        ],
      },
      {
        id: 12,
        breaks: [
          { id: 22, attendanceId: 12, startedAt: new Date(), endedAt: null },
        ],
      },
    ]);
    prisma.attendanceBreak.update.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: number };
        data: { endedAt: Date };
      }) => ({
        id: where.id,
        endedAt: data.endedAt,
      }),
    );

    const result = await service.stopBreak(mockUser);

    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 7,
          organizationId: 1,
          breaks: { some: { endedAt: null } },
        }),
      }),
    );
    expect(prisma.attendanceBreak.update).toHaveBeenCalledTimes(2);
    expect(result.closedBreakCount).toBe(2);
    expect(result.onBreak).toBe(false);
  });

  it('builds the daily attendance table with unscheduled and leave statuses', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Ava',
        department: 'Sales',
        designation: 'Executive',
        shift: null,
      },
      {
        id: 2,
        name: 'Ben',
        department: 'HR',
        designation: 'Manager',
        shift: null,
      },
      {
        id: 3,
        name: 'Cara',
        department: 'Ops',
        designation: 'Analyst',
        shift: null,
      },
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 101,
        employeeId: 1,
        checkIn: new Date('2026-03-13T09:00:00.000Z'),
        checkOut: new Date('2026-03-13T17:00:00.000Z'),
        workingHours: 8,
        status: AttendanceStatus.PRESENT,
      },
    ]);
    prisma.leaveRequest.findMany.mockResolvedValue([{ employeeId: 2 }]);

    const result = await service.getToday(mockUser, '2026-03-13');

    expect(result.summary).toEqual(
      expect.objectContaining({ present: 1, absent: 0, leave: 1, halfDay: 0 }),
    );
    expect(result.rows.map((row) => [row.employee.name, row.status])).toEqual([
      ['Ava', AttendanceStatus.PRESENT],
      ['Ben', AttendanceStatus.LEAVE],
      ['Cara', AttendanceStatus.NOT_SCHEDULED],
    ]);
  });

  it('includes active descendant employees in the admin attendance roster', async () => {
    mockOrganizationScopeService.getOrganizationIds.mockResolvedValue([1, 2]);
    mockOrganizationScopeService.getDescendantOrganizationIds.mockResolvedValue(
      [1, 2],
    );
    prisma.employee.findMany
      .mockResolvedValueOnce([{ id: 22 }])
      .mockResolvedValueOnce([
        {
          id: 22,
          name: 'Child Employee',
          department: 'Operations',
          designation: 'Coordinator',
          organization: { id: 2, name: 'Child Organization' },
          shift: null,
        },
      ]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);

    const result = await service.getToday(mockUser, '2026-03-13');

    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeId: 22,
          employee: expect.objectContaining({
            organization: { id: 2, name: 'Child Organization' },
          }),
        }),
      ]),
    );
    expect(prisma.employee.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ organizationId: { in: [2] } }),
          ]),
        }),
      }),
    );
  });

  it('limits an admin selecting a sibling organization to that selected subtree', async () => {
    mockOrganizationScopeService.getOrganizationFamilyRootId.mockImplementation(
      async (id: number) => (id === 9 ? 1 : id),
    );
    mockOrganizationScopeService.getDescendantOrganizationIds.mockResolvedValueOnce(
      [9, 10],
    );

    await expect(
      (service as any).getAttendanceOrganizationIds({
        ...mockUser,
        organizationId: 9,
        homeOrganizationId: 1,
      }),
    ).resolves.toEqual([9, 10]);

    expect(
      mockOrganizationScopeService.getDescendantOrganizationIds,
    ).toHaveBeenCalledWith(9);
    expect(
      mockOrganizationScopeService.getOrganizationFamilyRootId,
    ).toHaveBeenCalledWith(1);
    expect(
      mockOrganizationScopeService.getOrganizationFamilyRootId,
    ).toHaveBeenCalledWith(9);
  });

  it('rejects an admin selecting an organization outside their family', async () => {
    mockOrganizationScopeService.getOrganizationFamilyRootId.mockImplementation(
      async (id: number) => (id === 9 ? 2 : id),
    );

    await expect(
      (service as any).getAttendanceOrganizationIds({
        ...mockUser,
        organizationId: 9,
        homeOrganizationId: 1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a canonical family-wide holiday at the selected parent organization', async () => {
    mockOrganizationScopeService.getOrganizationIds.mockResolvedValue([
      1, 2, 3,
    ]);
    mockOrganizationScopeService.getOrganizationIds.mockResolvedValue([
      1, 2, 3,
    ]);
    mockOrganizationScopeService.getDescendantOrganizationIds.mockResolvedValue(
      [1, 2, 3],
    );
    mockOrganizationScopeService.getOrganizationFamilyRootId.mockResolvedValue(
      1,
    );
    prisma.holiday.findFirst.mockResolvedValue(null);
    prisma.holiday.create.mockResolvedValue({
      id: 41,
      organizationId: 1,
      familyRootOrganizationId: 1,
      name: 'Founders Day',
    });

    const result = await service.createHoliday(
      {
        name: 'Founders Day',
        startDate: '2026-10-02',
        endDate: '2026-10-02',
        familyWide: true,
      },
      { ...mockUser, homeOrganizationId: 1 },
    );

    expect(prisma.holiday.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 1,
          familyRootOrganizationId: 1,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ familyRootOrganizationId: 1 }),
    );
  });

  it('lists a shared holiday to a child organization as read-only', async () => {
    mockOrganizationScopeService.getOrganizationFamilyRootId.mockResolvedValue(
      1,
    );
    prisma.holiday.findMany.mockResolvedValue([
      {
        id: 41,
        organizationId: 1,
        familyRootOrganizationId: 1,
        name: 'Founders Day',
        startDate: new Date('2026-10-02T00:00:00.000Z'),
        endDate: new Date('2026-10-02T00:00:00.000Z'),
      },
    ]);

    const holidays = await service.listHolidays({
      ...mockUser,
      organizationId: 2,
      homeOrganizationId: 1,
    });

    expect(holidays[0]).toEqual(
      expect.objectContaining({
        familyRootOrganizationId: 1,
        canManage: false,
      }),
    );
  });

  it('applies the parent family holiday to a child employee attendance calendar', async () => {
    mockOrganizationScopeService.getOrganizationIds.mockResolvedValue([1, 2]);
    mockOrganizationScopeService.getDescendantOrganizationIds.mockResolvedValue(
      [2],
    );
    mockBusinessUnitsService.resolveScope.mockResolvedValue({
      organizationId: 2,
      allUnits: true,
      unitIds: [],
      assignedUnitId: null,
    });
    mockBusinessUnitsService.buildEmployeeBUWhere.mockReturnValue({
      organizationId: 2,
      deletedAt: null,
    });
    const employee = {
      id: 4,
      name: 'Dina',
      department: 'Finance',
      designation: 'Lead',
      organizationId: 2,
      shift: null,
    };
    prisma.employee.findUnique.mockResolvedValue(employee);
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
    mockOrganizationScopeService.getOrganizationFamilyRootId.mockResolvedValue(
      1,
    );
    mockOrganizationScopeService.getOrganizationFamilyRootMap.mockResolvedValue(
      new Map([[2, 1]]),
    );
    prisma.holiday.findMany.mockResolvedValue([
      {
        id: 88,
        organizationId: 1,
        familyRootOrganizationId: 1,
        startDate: new Date('2026-03-13T00:00:00.000Z'),
        endDate: new Date('2026-03-13T00:00:00.000Z'),
        name: 'Founders Day',
      },
    ]);

    const result = await service.getEmployeeAttendance(
      4,
      {
        ...mockUser,
        organizationId: 2,
        homeOrganizationId: 1,
      },
      '2026-03',
    );

    expect(result.days[12]).toEqual(
      expect.objectContaining({
        status: AttendanceStatus.HOLIDAY,
        holidayName: 'Founders Day',
      }),
    );
  });

  it('prevents a child organization from editing a family-wide holiday', async () => {
    mockOrganizationScopeService.getOrganizationFamilyRootId.mockResolvedValue(
      1,
    );
    prisma.holiday.findFirst.mockResolvedValue({
      id: 88,
      organizationId: 1,
      familyRootOrganizationId: 1,
      startDate: new Date('2026-03-13T00:00:00.000Z'),
      endDate: new Date('2026-03-13T00:00:00.000Z'),
      name: 'Founders Day',
    });

    await expect(
      service.updateHoliday(
        88,
        { name: 'Updated' },
        {
          ...mockUser,
          organizationId: 2,
          homeOrganizationId: 1,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.holiday.update).not.toHaveBeenCalled();
  });

  it('excludes employees before their hire date from daily attendance', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 8,
        name: 'New Hire',
        department: 'Sales',
        designation: 'Executive',
        hireDate: new Date('2026-03-14T00:00:00.000Z'),
        shift: null,
      },
    ]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);

    const result = await service.getToday(mockUser, '2026-03-13');

    expect(result.rows).toHaveLength(0);
    expect(result.summary.totalWorkingDays).toBe(0);
  });

  it('rejects check-in before the employee hire date', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 7,
      hireDate: new Date('2026-03-14T00:00:00.000Z'),
      shift: {
        id: 1,
        name: 'Day',
        type: 'FIXED',
        startTime: '09:00',
        endTime: '17:00',
        requiredHours: 8,
        minPresentHours: 5,
        gracePeriodMinutes: 15,
        weeklyHolidayDay: 0,
      },
    });

    await expect(
      service.checkIn({ employeeId: 7, date: '2026-03-13' }, mockUser),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.attendance.findUnique).not.toHaveBeenCalled();
  });

  it('keeps a late full-shift employee present', () => {
    jest.setSystemTime(new Date('2026-03-13T18:00:00.000Z'));
    const shift = {
      id: 1,
      name: 'Day',
      type: 'FIXED' as const,
      startTime: '09:00',
      endTime: '17:00',
      requiredHours: 8,
      minPresentHours: 5,
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
    };

    expect(
      (service as any).calculateStatus({
        day: new Date('2026-03-13T00:00:00.000Z'),
        checkIn: new Date('2026-03-13T09:45:00.000Z'),
        checkOut: new Date('2026-03-13T18:00:00.000Z'),
        workingHours: 8.25,
        onLeave: false,
        shift,
        lateMinutes: 30,
      }),
    ).toBe(AttendanceStatus.PRESENT);
  });

  it('treats a corporate holiday as non-absence unless the employee worked or is on leave', () => {
    const day = new Date('2026-03-13T00:00:00.000Z');
    const employee = {
      id: 7,
      name: 'Ava',
      department: 'Sales',
      designation: 'Associate',
      shift: null,
    };

    const holidayRow = (service as any).toDailyRow(
      employee,
      day,
      null,
      false,
      'Founders Day',
    );
    const workedRow = (service as any).toDailyRow(
      employee,
      day,
      {
        id: 1,
        checkIn: new Date('2026-03-13T09:00:00.000Z'),
        checkOut: null,
        workingHours: null,
        lateMinutes: 0,
        overtimeHours: 0,
        shortfallHours: 0,
        status: AttendanceStatus.PRESENT,
      },
      false,
      'Founders Day',
    );
    const leaveRow = (service as any).toDailyRow(
      employee,
      day,
      null,
      true,
      'Founders Day',
    );

    expect(holidayRow).toEqual(
      expect.objectContaining({
        status: AttendanceStatus.HOLIDAY,
        holidayName: 'Founders Day',
      }),
    );
    expect(workedRow.status).toBe(AttendanceStatus.PRESENT);
    expect(leaveRow.status).toBe(AttendanceStatus.LEAVE);
  });

  it('uses planning statuses for future and before-shift days', () => {
    jest.setSystemTime(new Date('2026-03-13T08:00:00.000Z'));
    const shift = {
      id: 1,
      name: 'Day',
      type: 'FIXED' as const,
      startTime: '09:00',
      endTime: '17:00',
      requiredHours: 8,
      minPresentHours: 5,
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
    };

    expect(
      (service as any).calculateStatus({
        day: new Date('2026-03-13T00:00:00.000Z'),
        checkIn: null,
        checkOut: null,
        workingHours: null,
        onLeave: false,
        shift,
      }),
    ).toBe(AttendanceStatus.NOT_STARTED);
    expect(
      (service as any).calculateStatus({
        day: new Date('2026-03-14T00:00:00.000Z'),
        checkIn: null,
        checkOut: null,
        workingHours: null,
        onLeave: false,
        shift,
      }),
    ).toBe(AttendanceStatus.UPCOMING);
  });

  it('allows a manager to view their own attendance using the me endpoint', async () => {
    const managerUser = {
      ...mockUser,
      role: Role.MANAGER,
      userId: 2,
      employeeId: 7,
    };

    prisma.employee.findFirst.mockResolvedValue({ id: 7 } as any);
    prisma.employee.findMany
      .mockResolvedValueOnce([{ id: 8 }])
      .mockResolvedValueOnce([
        {
          id: 7,
          name: 'Mona',
          department: 'Sales',
          designation: 'Manager',
          shift: null,
        },
      ]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);

    const result = await service.findMine(
      { date: '2026-03-13', page: 1, limit: 10 },
      managerUser,
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].employeeId).toBe(7);
    expect(result.data[0].employee.name).toBe('Mona');
  });

  it('returns the manager-own row for getMySnapshot when team rows are present', async () => {
    const managerUser = {
      ...mockUser,
      role: Role.MANAGER,
      userId: 2,
      employeeId: 7,
    };

    prisma.employee.findFirst.mockResolvedValue({ id: 7 } as any);
    jest.spyOn(service, 'getToday').mockResolvedValue({
      date: '2026-03-13T00:00:00.000Z',
      summary: {
        present: 2,
        absent: 0,
        leave: 0,
        halfDay: 0,
        lateCount: 0,
        overtimeHours: 0,
        presentDays: 2,
        absentDays: 0,
        leaveDays: 0,
        halfDays: 0,
        totalWorkingDays: 2,
      },
      rows: [
        {
          id: 101,
          employeeId: 8,
          employee: {
            id: 8,
            name: 'Team Member',
            department: 'Sales',
            designation: 'Executive',
          },
          date: '2026-03-13T00:00:00.000Z',
          checkIn: '2026-03-13T09:00:00.000Z',
          checkOut: '2026-03-13T17:00:00.000Z',
          workingHours: 8,
          lateMinutes: 0,
          overtimeHours: 0,
          status: AttendanceStatus.PRESENT,
          shiftDetails: null,
        },
        {
          id: 102,
          employeeId: 7,
          employee: {
            id: 7,
            name: 'Mona',
            department: 'Sales',
            designation: 'Manager',
          },
          date: '2026-03-13T00:00:00.000Z',
          checkIn: '2026-03-13T09:30:00.000Z',
          checkOut: '2026-03-13T18:30:00.000Z',
          workingHours: 8,
          lateMinutes: 30,
          overtimeHours: 0,
          status: AttendanceStatus.PRESENT,
          shiftDetails: null,
        },
      ],
    } as any);

    const result = await service.getMySnapshot(managerUser);

    expect(result.status).toBe(AttendanceStatus.PRESENT);
    expect(result.checkIn).toBe('2026-03-13T09:30:00.000Z');
    expect(result.checkOut).toBe('2026-03-13T18:30:00.000Z');
  });

  it('allows a super admin to view attendance without forcing a single organization scope', async () => {
    prisma.attendance.findMany.mockResolvedValue([]);

    await service.getSummary(
      { month: '2026-03' },
      {
        ...mockUser,
        role: Role.SUPER_ADMIN,
        organizationId: 42,
      },
    );

    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ organizationId: 42 }),
      }),
    );
  });

  it('includes absent scheduled hours and live work in monthly totals', async () => {
    jest.setSystemTime(new Date('2026-03-04T12:00:00.000Z'));
    const shift = {
      requiredHours: 8,
      weeklyHolidayDay: 0,
    };
    const employee = { hireDate: null, organizationId: 1 };
    prisma.attendance.findMany.mockResolvedValue([
      {
        date: new Date('2026-03-02T00:00:00.000Z'),
        checkIn: new Date('2026-03-02T09:00:00.000Z'),
        checkOut: new Date('2026-03-02T16:00:00.000Z'),
        workingHours: 6,
        taskHours: 1.5,
        breaks: [],
        shift,
        employee,
        status: AttendanceStatus.PRESENT,
      },
      {
        date: new Date('2026-03-03T00:00:00.000Z'),
        checkIn: null,
        checkOut: null,
        workingHours: null,
        breaks: [],
        shift,
        employee,
        status: AttendanceStatus.ABSENT,
      },
      {
        date: new Date('2026-03-04T00:00:00.000Z'),
        checkIn: new Date('2026-03-04T09:00:00.000Z'),
        checkOut: null,
        workingHours: null,
        breaks: [
          {
            startedAt: new Date('2026-03-04T10:00:00.000Z'),
            endedAt: new Date('2026-03-04T10:30:00.000Z'),
          },
        ],
        shift,
        employee,
        status: AttendanceStatus.PRESENT,
      },
    ] as any);

    const result = await service.getSummary(
      { month: '2026-03' },
      mockUser as any,
    );

    expect(result.totalExpectedHours).toBe(24);
    expect(result.totalTaskHours).toBe(1.5);
    expect(result.totalWorkedHours).toBe(10);
  });

  it('uses flexible task-time day equivalents in monthly summaries', async () => {
    jest.setSystemTime(new Date('2026-10-17T12:00:00.000Z'));
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 19,
        hireDate: null,
        organizationId: 1,
        shift: { id: 3, type: 'FLEXIBLE', requiredHours: 8 },
        shiftAssignments: [],
        organization: { timezone: 'UTC' },
      },
    ]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.taskTimerInterval.findMany.mockResolvedValue([
      {
        startedAt: new Date('2026-10-17T04:00:00.000Z'),
        endedAt: new Date('2026-10-17T12:00:00.000Z'),
      },
    ]);

    const result = await service.getSummary(
      { month: '2026-10' },
      mockUser as any,
    );

    expect(result.presentDays).toBe(1);
    expect(result.totalWorkingDays).toBe(1);
    expect(result.totalWorkedHours).toBe(8);
    expect(result.totalExpectedHours).toBe(8);
  });

  it("blocks employees from requesting another employee's monthly report", async () => {
    await expect(
      service.getMonthlyReport(
        { employeeId: 99 },
        {
          ...mockUser,
          role: Role.EMPLOYEE,
          employeeId: 7,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses the authorized descendant employee ids for monthly attendance queries', async () => {
    mockOrganizationScopeService.getOrganizationIds.mockResolvedValue([1, 2]);
    mockOrganizationScopeService.getDescendantOrganizationIds.mockResolvedValue(
      [1, 2],
    );
    prisma.employee.findMany
      .mockResolvedValueOnce([{ id: 10 }, { id: 20 }])
      .mockResolvedValueOnce([
        {
          id: 10,
          name: 'Parent employee',
          hireDate: null,
          department: 'Ops',
          organization: { id: 1, name: 'Parent' },
          user: { role: 'EMPLOYEE' },
        },
        {
          id: 20,
          name: 'Child employee',
          hireDate: null,
          department: 'Ops',
          organization: { id: 2, name: 'Child' },
          user: { role: 'EMPLOYEE' },
        },
      ]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);

    const result = await service.getMonthlyReport(
      { year: 2026, month: 3 } as any,
      mockUser as any,
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows[1]).toEqual(
      expect.objectContaining({ organization: { id: 2, name: 'Child' } }),
    );
    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ organizationId: 1 }),
      }),
    );
  });

  it('excludes corporate holidays from monthly absent and working-day totals', async () => {
    prisma.employee.findMany.mockResolvedValueOnce([
      {
        id: 7,
        name: 'Ava',
        hireDate: null,
        department: 'Sales',
        designation: 'Associate',
        organization: { id: 1, name: 'Main' },
        user: { role: 'EMPLOYEE' },
      },
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 11,
        employeeId: 7,
        date: new Date('2026-03-13T00:00:00.000Z'),
        checkIn: null,
        status: AttendanceStatus.ABSENT,
        lateMinutes: 0,
        overtimeHours: 0,
        workingHours: null,
        shift: null,
      },
    ]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
    prisma.holiday.findMany.mockResolvedValue([
      {
        organizationId: 1,
        startDate: new Date('2026-03-13T00:00:00.000Z'),
        endDate: new Date('2026-03-14T00:00:00.000Z'),
        name: 'Founders Day',
      },
    ]);

    const result = await service.getMonthlyReport(
      { year: 2026, month: 3 } as any,
      mockUser as any,
    );

    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        absentCount: 0,
        holidayCount: 2,
        workingDays: 0,
        attendancePercent: 0,
      }),
    );
  });

  it('reports flexible monthly working days from task hours rather than attendance rows', async () => {
    jest.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));
    prisma.employee.findMany.mockResolvedValueOnce([
      {
        id: 7,
        name: 'Ava',
        hireDate: null,
        department: 'Sales',
        designation: 'Associate',
        shift: { type: 'FLEXIBLE', requiredHours: 6 },
        organization: { id: 1, name: 'Main', timezone: 'UTC' },
        user: { role: 'EMPLOYEE' },
      },
    ]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
    prisma.taskTimerInterval.findMany.mockResolvedValue([
      {
        startedAt: new Date('2026-10-17T08:00:00.000Z'),
        endedAt: new Date('2026-10-17T10:00:00.000Z'),
      },
      {
        startedAt: new Date('2026-10-18T08:00:00.000Z'),
        endedAt: new Date('2026-10-18T11:00:00.000Z'),
      },
      {
        startedAt: new Date('2026-10-19T08:00:00.000Z'),
        endedAt: new Date('2026-10-19T11:00:00.000Z'),
      },
    ]);
    prisma.taskTimerSession.findMany.mockResolvedValue([]);

    const result = await service.getMonthlyReport(
      { year: 2026, month: 10 } as any,
      mockUser as any,
    );

    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        isFlexible: true,
        workingDayEquivalents: 1,
        workingDays: 1,
        presentCount: 1,
        totalWorkedHours: 8,
        attendancePercent: 0,
      }),
    );
  });

  it('includes legacy attendance hours in flexible monthly working-day equivalents', async () => {
    jest.setSystemTime(new Date('2026-03-20T12:00:00.000Z'));
    prisma.employee.findMany.mockResolvedValueOnce([
      {
        id: 7,
        name: 'Ava',
        hireDate: null,
        department: 'Sales',
        designation: 'Associate',
        shift: { type: 'FLEXIBLE', requiredHours: 6 },
        organization: { id: 1, name: 'Main', timezone: 'UTC' },
        user: { role: 'EMPLOYEE' },
      },
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 21,
        employeeId: 7,
        date: new Date('2026-03-10T00:00:00.000Z'),
        checkIn: new Date('2026-03-10T08:00:00.000Z'),
        checkOut: new Date('2026-03-10T10:00:00.000Z'),
        workingHours: 2,
        taskHours: 1.25,
        breaks: [],
        status: AttendanceStatus.PRESENT,
      },
      {
        id: 22,
        employeeId: 7,
        date: new Date('2026-03-12T00:00:00.000Z'),
        checkIn: new Date('2026-03-12T08:00:00.000Z'),
        checkOut: new Date('2026-03-12T11:00:00.000Z'),
        workingHours: 3,
        breaks: [],
        status: AttendanceStatus.PRESENT,
      },
      {
        id: 23,
        employeeId: 7,
        date: new Date('2026-03-16T00:00:00.000Z'),
        checkIn: new Date('2026-03-16T08:00:00.000Z'),
        checkOut: new Date('2026-03-16T11:00:00.000Z'),
        workingHours: 3,
        breaks: [],
        status: AttendanceStatus.PRESENT,
      },
    ]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
    prisma.taskTimerInterval.findMany.mockResolvedValue([]);
    prisma.taskTimerSession.findMany.mockResolvedValue([]);

    const result = await service.getMonthlyReport(
      { year: 2026, month: 3 } as any,
      mockUser as any,
    );

    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        isFlexible: true,
        workingDayEquivalents: 1,
        workingDays: 1,
        presentCount: 1,
        totalWorkedHours: 9.25,
      }),
    );
  });

  it('returns monthly employee attendance data for calendar rendering', async () => {
    const mockEmployee = {
      id: 4,
      name: 'Dina',
      department: 'Finance',
      designation: 'Lead',
      shift: null,
    };
    prisma.employee.findUnique.mockResolvedValue(mockEmployee);
    prisma.employee.findFirst.mockResolvedValue(mockEmployee);
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 201,
        employeeId: 4,
        date: new Date('2026-03-02T00:00:00.000Z'),
        checkIn: new Date('2026-03-02T09:00:00.000Z'),
        checkOut: new Date('2026-03-02T18:00:00.000Z'),
        workingHours: 9,
        breaks: [
          {
            startedAt: new Date('2026-03-02T12:00:00.000Z'),
            endedAt: new Date('2026-03-02T12:30:00.000Z'),
          },
        ],
        status: AttendanceStatus.PRESENT,
        createdAt: new Date('2026-03-02T09:00:00.000Z'),
      },
    ]);
    prisma.leaveRequest.findMany.mockResolvedValue([
      {
        employeeId: 4,
        startDate: new Date('2026-03-03T00:00:00.000Z'),
        endDate: new Date('2026-03-03T23:59:59.000Z'),
      },
    ]);

    const result = await service.getEmployeeAttendance(4, mockUser, '2026-03');

    expect(result.month).toBe('2026-03');
    expect(result.days[1].status).toBe(AttendanceStatus.PRESENT);
    expect(result.days[1].breaks).toEqual([
      {
        startedAt: '2026-03-02T12:00:00.000Z',
        endedAt: '2026-03-02T12:30:00.000Z',
      },
    ]);
    expect(result.days[2].status).toBe(AttendanceStatus.LEAVE);
    expect(result.summary.present).toBeGreaterThanOrEqual(1);
    expect(result.summary.leave).toBeGreaterThanOrEqual(1);
  });

  it('counts scheduled absences and live work across a week-month boundary', async () => {
    jest.setSystemTime(new Date('2026-04-01T12:00:00.000Z'));
    const shift = {
      id: 2,
      name: 'Day',
      type: 'FIXED',
      startTime: '09:00',
      endTime: '17:00',
      requiredHours: 8,
      minPresentHours: 5,
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
    };
    prisma.attendance.findMany.mockResolvedValue([
      {
        date: new Date('2026-03-30T00:00:00.000Z'),
        workingHours: 6,
        shift,
        breaks: [],
      },
      {
        date: new Date('2026-04-01T00:00:00.000Z'),
        checkIn: new Date('2026-04-01T09:00:00.000Z'),
        checkOut: null,
        workingHours: null,
        shift,
        breaks: [
          {
            startedAt: new Date('2026-04-01T10:00:00.000Z'),
            endedAt: new Date('2026-04-01T10:30:00.000Z'),
          },
        ],
      },
    ]);
    prisma.holiday.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);

    const balances = await (service as any).getWorkHourBalancesForEmployee(
      7,
      { id: 7, organizationId: 1, hireDate: null, shift },
      new Date('2026-04-01T12:00:00.000Z'),
      'UTC',
    );

    expect(balances.week).toEqual(
      expect.objectContaining({
        requiredHours: 48,
        completedHours: 8.5,
        taskWorkHours: 0,
        breakHours: 0.5,
        remainingHours: 39.5,
      }),
    );
    expect(balances.month).toEqual(
      expect.objectContaining({
        requiredHours: 8,
        completedHours: 2.5,
        taskWorkHours: 0,
        breakHours: 0.5,
        remainingHours: 5.5,
      }),
    );
  });

  it('uses only task timer intervals in fixed-shift progress balances', async () => {
    const now = new Date('2026-10-19T12:00:00.000Z');
    const shift = {
      id: 2,
      name: 'Day',
      type: 'FIXED',
      startTime: '09:00',
      endTime: '17:00',
      requiredHours: 8,
      minPresentHours: 5,
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
    };
    prisma.attendance.findMany.mockResolvedValue([
      {
        date: new Date('2026-10-19T00:00:00.000Z'),
        checkIn: new Date('2026-10-19T08:00:00.000Z'),
        checkOut: new Date('2026-10-19T16:00:00.000Z'),
        workingHours: 8,
        shift,
        breaks: [],
      },
    ]);
    prisma.taskTimerInterval.findMany.mockResolvedValue([
      {
        startedAt: new Date('2026-10-19T09:00:00.000Z'),
        endedAt: new Date('2026-10-19T11:00:00.000Z'),
      },
    ]);
    prisma.holiday.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);

    const balances = await (service as any).getWorkHourBalancesForEmployee(
      7,
      { id: 7, organizationId: 1, hireDate: null, shift },
      now,
      'UTC',
    );

    expect(balances.week).toEqual(
      expect.objectContaining({
        completedHours: 8,
        taskWorkHours: 2,
      }),
    );
    expect(balances.month).toEqual(
      expect.objectContaining({
        completedHours: 8,
        taskWorkHours: 2,
      }),
    );
  });

  it('adds manual task timesheets to timer time in period ring balances', async () => {
    const now = new Date('2026-10-20T12:00:00.000Z');
    const shift = {
      id: 2,
      name: 'Day',
      type: 'FIXED',
      startTime: '09:00',
      endTime: '17:00',
      requiredHours: 8,
      minPresentHours: 5,
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
      workingDays: [1, 2, 3, 4, 5],
    };
    jest.setSystemTime(now);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.holiday.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
    prisma.taskTimerInterval.findMany.mockResolvedValue([
      {
        startedAt: new Date('2026-10-19T09:00:00.000Z'),
        endedAt: new Date('2026-10-19T11:00:00.000Z'),
      },
      {
        startedAt: new Date('2026-10-20T09:00:00.000Z'),
        endedAt: new Date('2026-10-20T10:00:00.000Z'),
      },
    ]);
    prisma.timesheet.findMany.mockResolvedValue([
      { date: new Date('2026-10-19T00:00:00.000Z'), hours: 1.5 },
      { date: new Date('2026-10-20T00:00:00.000Z'), hours: 0.5 },
    ]);

    const balances = await (service as any).getWorkHourBalancesForEmployee(
      7,
      { id: 7, organizationId: 1, hireDate: null, shift },
      now,
      'UTC',
    );

    expect(balances.week).toEqual(
      expect.objectContaining({
        taskWorkHours: 5,
        taskWorkActiveDays: 2,
      }),
    );
    expect(balances.month).toEqual(
      expect.objectContaining({
        taskWorkHours: 5,
        taskWorkActiveDays: 2,
      }),
    );
    expect(prisma.timesheet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 7,
          organizationId: 1,
          status: { not: 'REJECTED' },
          source: { not: 'TASK_TIMER' },
          deletedAt: null,
        }),
      }),
    );
  });

  it('earns one flexible working day from eight task hours across three dates', async () => {
    const now = new Date('2026-10-19T12:00:00.000Z');
    const shift = {
      id: 4,
      name: 'Flexible',
      type: 'FLEXIBLE',
      startTime: '09:00',
      endTime: '17:00',
      requiredHours: 6,
      minPresentHours: 4,
      gracePeriodMinutes: 0,
      weeklyHolidayDay: 0,
    };
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.taskTimerInterval.findMany.mockResolvedValue([
      {
        startedAt: new Date('2026-10-17T08:00:00.000Z'),
        endedAt: new Date('2026-10-17T10:00:00.000Z'),
      },
      {
        startedAt: new Date('2026-10-18T08:00:00.000Z'),
        endedAt: new Date('2026-10-18T11:00:00.000Z'),
      },
      {
        startedAt: new Date('2026-10-19T07:00:00.000Z'),
        endedAt: new Date('2026-10-19T10:00:00.000Z'),
      },
    ]);

    const balances = await (service as any).getWorkHourBalancesForEmployee(
      7,
      { id: 7, organizationId: 1, hireDate: null, shift },
      now,
      'UTC',
    );

    expect(balances.week).toEqual(
      expect.objectContaining({
        flexible: true,
        workdayHours: 8,
        completedHours: 3,
        activeDays: 1,
        workingDayEquivalents: 0.38,
        taskWorkHours: 3,
        taskWorkActiveDays: 1,
        taskWorkWorkingDayEquivalents: 0.38,
      }),
    );
    expect(balances.month).toEqual(
      expect.objectContaining({
        completedHours: 8,
        workingDayEquivalents: 1,
        taskWorkHours: 8,
        taskWorkActiveDays: 3,
        taskWorkWorkingDayEquivalents: 1,
      }),
    );
  });

  it('keeps legacy flexible attendance out of task-tracked ring values', async () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const shift = {
      id: 4,
      name: 'Flexible',
      type: 'FLEXIBLE',
      startTime: '09:00',
      endTime: '17:00',
      requiredHours: 6,
      minPresentHours: 4,
      gracePeriodMinutes: 0,
      weeklyHolidayDay: 0,
    };
    prisma.attendance.findMany.mockResolvedValue([
      {
        date: new Date('2026-10-14T00:00:00.000Z'),
        checkIn: new Date('2026-10-14T08:00:00.000Z'),
        checkOut: new Date('2026-10-14T10:00:00.000Z'),
        workingHours: 2,
        shift,
        breaks: [],
      },
      {
        date: new Date('2026-10-15T00:00:00.000Z'),
        checkIn: new Date('2026-10-15T08:00:00.000Z'),
        checkOut: new Date('2026-10-15T11:00:00.000Z'),
        workingHours: 3,
        shift,
        breaks: [],
      },
      {
        date: new Date('2026-10-16T00:00:00.000Z'),
        checkIn: new Date('2026-10-16T07:00:00.000Z'),
        checkOut: new Date('2026-10-16T10:00:00.000Z'),
        workingHours: 3,
        shift,
        breaks: [],
      },
    ]);
    prisma.taskTimerInterval.findMany.mockResolvedValue([]);

    const balances = await (service as any).getWorkHourBalancesForEmployee(
      7,
      { id: 7, organizationId: 1, hireDate: null, shift },
      now,
      'UTC',
    );

    expect(balances.week).toEqual(
      expect.objectContaining({
        completedHours: 8,
        activeDays: 3,
        workingDayEquivalents: 1,
        taskWorkHours: 0,
        taskWorkActiveDays: 0,
        taskWorkWorkingDayEquivalents: 0,
      }),
    );
    expect(balances.month).toEqual(
      expect.objectContaining({
        completedHours: 8,
        activeDays: 3,
        workingDayEquivalents: 1,
        taskWorkHours: 0,
        taskWorkActiveDays: 0,
        taskWorkWorkingDayEquivalents: 0,
      }),
    );
  });

  it('uses task time instead of legacy attendance for dates with task intervals', async () => {
    const now = new Date('2026-10-17T12:00:00.000Z');
    const shift = {
      id: 4,
      name: 'Flexible',
      type: 'FLEXIBLE',
      startTime: '09:00',
      endTime: '17:00',
      requiredHours: 8,
      minPresentHours: 4,
      gracePeriodMinutes: 0,
      weeklyHolidayDay: 0,
    };
    prisma.attendance.findMany.mockResolvedValue([
      {
        date: new Date('2026-10-17T00:00:00.000Z'),
        checkIn: new Date('2026-10-17T08:00:00.000Z'),
        checkOut: new Date('2026-10-17T16:00:00.000Z'),
        workingHours: 8,
        shift,
        breaks: [],
      },
    ]);
    prisma.taskTimerInterval.findMany.mockResolvedValue([
      {
        startedAt: new Date('2026-10-17T08:00:00.000Z'),
        endedAt: new Date('2026-10-17T10:00:00.000Z'),
      },
    ]);

    const balances = await (service as any).getWorkHourBalancesForEmployee(
      7,
      { id: 7, organizationId: 1, hireDate: null, shift },
      now,
      'UTC',
    );

    expect(balances.week).toEqual(
      expect.objectContaining({
        completedHours: 2,
        activeDays: 1,
        workingDayEquivalents: 0.25,
      }),
    );
  });

  it('does not use check-in/out as work credit on or after the task-time cutover', async () => {
    const now = new Date('2026-10-17T12:00:00.000Z');
    const shift = {
      id: 4,
      name: 'Flexible',
      type: 'FLEXIBLE',
      startTime: '09:00',
      endTime: '17:00',
      requiredHours: 8,
      minPresentHours: 4,
      gracePeriodMinutes: 0,
      weeklyHolidayDay: 0,
    };
    prisma.attendance.findMany.mockResolvedValue([
      {
        date: new Date('2026-10-17T00:00:00.000Z'),
        checkIn: new Date('2026-10-17T08:00:00.000Z'),
        checkOut: new Date('2026-10-17T16:00:00.000Z'),
        workingHours: 8,
        shift,
        breaks: [],
      },
    ]);
    prisma.taskTimerInterval.findMany.mockResolvedValue([]);

    const balances = await (service as any).getWorkHourBalancesForEmployee(
      7,
      { id: 7, organizationId: 1, hireDate: null, shift },
      now,
      'UTC',
    );

    expect(balances.week).toEqual(
      expect.objectContaining({
        completedHours: 0,
        activeDays: 0,
        workingDayEquivalents: 0,
      }),
    );
  });

  it('uses five scheduled days for week and month targets', async () => {
    const now = new Date('2026-10-03T12:00:00.000Z');
    const shift = {
      id: 3,
      name: 'Weekday',
      type: 'FIXED',
      startTime: '09:00',
      endTime: '18:00',
      requiredHours: 8,
      minPresentHours: 5,
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
      workingDays: [1, 2, 3, 4, 5],
    };
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.holiday.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);

    const balances = await (service as any).getWorkHourBalancesForEmployee(
      7,
      { id: 7, organizationId: 1, hireDate: null, shift },
      now,
      'UTC',
    );

    expect(balances.week).toEqual(
      expect.objectContaining({
        requiredHours: 40,
        scheduledDays: 5,
        completedHours: 0,
      }),
    );
    expect(balances.month).toEqual(
      expect.objectContaining({
        requiredHours: 16,
        scheduledDays: 2,
        fullPeriodRequiredHours: 176,
        fullPeriodScheduledDays: 22,
      }),
    );
  });

  it('returns weekly balances for employees within the admin scope', async () => {
    const shift = {
      id: 3,
      name: 'Weekday',
      type: 'FIXED',
      startTime: '09:00',
      endTime: '18:00',
      requiredHours: 8,
      minPresentHours: 5,
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
      workingDays: [1, 2, 3, 4, 5],
    };
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 7,
        name: 'Ava',
        department: 'Ops',
        organizationId: 1,
        hireDate: null,
        shift,
      },
    ]);
    prisma.organization.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.holiday.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);

    const result = await service.getTeamWeeklyWorkHours(mockUser);

    expect(result.employees).toHaveLength(1);
    expect(result.employees[0]).toEqual(
      expect.objectContaining({
        employeeId: 7,
        employeeName: 'Ava',
        week: expect.objectContaining({ requiredHours: 40, scheduledDays: 5 }),
      }),
    );
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: { in: [1] },
          deletedAt: null,
        }),
      }),
    );
  });

  it('includes weekly timer intervals and active timers in team worked hours', async () => {
    jest.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
    const shift = {
      id: 3,
      name: 'Weekday',
      type: 'FIXED',
      startTime: '09:00',
      endTime: '18:00',
      requiredHours: 8,
      minPresentHours: 5,
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
      workingDays: [1, 2, 3, 4, 5],
    };
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 7,
        name: 'Ava',
        department: 'Ops',
        organizationId: 1,
        hireDate: null,
        shift,
      },
    ]);
    prisma.organization.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.holiday.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
    prisma.taskTimerInterval.findMany.mockResolvedValue([
      {
        startedAt: new Date('2026-10-16T09:00:00.000Z'),
        endedAt: new Date('2026-10-16T10:00:00.000Z'),
        timerSession: { user: { employeeId: 7 } },
      },
    ]);
    prisma.taskTimerSession.findMany.mockResolvedValue([
      {
        startedAt: new Date('2026-10-16T10:00:00.000Z'),
        user: { employeeId: 7 },
      },
    ]);

    const result = await service.getTeamWeeklyWorkHours(mockUser);

    expect(result.employees[0].taskTrackedHours).toBe(3);
    expect(result.employees[0].week.completedHours).toBe(0);
    expect(prisma.taskTimerInterval.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startedAt: { lt: new Date('2026-10-19T00:00:00.000Z') },
          endedAt: { gt: new Date('2026-10-12T00:00:00.000Z') },
        }),
      }),
    );
  });

  it('uses the selected organization subtree for team hours after an admin switches organizations', async () => {
    const switchedUser = {
      ...mockUser,
      organizationId: 9,
      homeOrganizationId: 1,
    };
    mockOrganizationScopeService.getOrganizationFamilyRootId.mockImplementation(
      async (id: number) => (id === 9 ? 1 : id),
    );
    mockOrganizationScopeService.getDescendantOrganizationIds.mockResolvedValue(
      [9, 10],
    );
    jest
      .spyOn(service as any, 'getScopedEmployeeFilter')
      .mockResolvedValue(null);
    prisma.employee.findMany.mockResolvedValue([]);

    await expect(
      service.getTeamWeeklyWorkHours(switchedUser as any),
    ).resolves.toEqual({
      employees: [],
    });

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: { in: [9, 10] },
          deletedAt: null,
        }),
      }),
    );
    expect(
      mockOrganizationScopeService.getDescendantOrganizationIds,
    ).toHaveBeenCalledWith(9);
  });

  it('shows a corporate holiday in the employee calendar without marking the day absent', async () => {
    const mockEmployee = {
      id: 4,
      name: 'Dina',
      department: 'Finance',
      designation: 'Lead',
      organizationId: 1,
      shift: null,
    };
    prisma.employee.findUnique.mockResolvedValue(mockEmployee);
    prisma.employee.findFirst.mockResolvedValue(mockEmployee);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
    prisma.holiday.findMany.mockResolvedValue([
      {
        organizationId: 1,
        startDate: new Date('2026-03-13T00:00:00.000Z'),
        endDate: new Date('2026-03-14T00:00:00.000Z'),
        name: 'Founders Day',
      },
    ]);

    const result = await service.getEmployeeAttendance(4, mockUser, '2026-03');

    expect(result.days[12]).toEqual(
      expect.objectContaining({
        status: AttendanceStatus.HOLIDAY,
        holidayName: 'Founders Day',
      }),
    );
    expect(result.days[13]).toEqual(
      expect.objectContaining({
        status: AttendanceStatus.HOLIDAY,
        holidayName: 'Founders Day',
      }),
    );
    expect(result.summary.absent).toBe(0);
    expect(result.summary.holiday).toBe(2);
  });

  it('omits pre-hire dates from the monthly calendar', async () => {
    const mockEmployee = {
      id: 4,
      name: 'Dina',
      department: 'Finance',
      designation: 'Lead',
      hireDate: new Date('2026-03-03T00:00:00.000Z'),
      shift: null,
    };
    prisma.employee.findUnique.mockResolvedValue(mockEmployee);
    prisma.employee.findFirst.mockResolvedValue(mockEmployee);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);

    const result = await service.getEmployeeAttendance(4, mockUser, '2026-03');

    expect(result.days[0].day).toBe(3);
    expect(result.days).toHaveLength(29);
    expect(result.summary.absent).toBe(0);
  });

  it('marks configured weekly holidays in the monthly calendar', async () => {
    const mockEmployee = {
      id: 4,
      name: 'Dina',
      department: 'Finance',
      designation: 'Lead',
      shift: {
        id: 2,
        name: 'Day',
        type: 'FIXED',
        startTime: '09:00',
        endTime: '17:00',
        requiredHours: 8,
        minPresentHours: 5,
        gracePeriodMinutes: 15,
        weeklyHolidayDay: 0,
      },
    };
    prisma.employee.findUnique.mockResolvedValue(mockEmployee);
    prisma.employee.findFirst.mockResolvedValue(mockEmployee);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);

    const result = await service.getEmployeeAttendance(4, mockUser, '2026-03');

    expect(result.days[0].status).toBe(AttendanceStatus.WEEKLY_OFF);
    expect(result.summary.totalWorkingDays).toBe(26);
  });

  it('creates weekly-off rows during daily automation', async () => {
    jest.setSystemTime(new Date('2026-03-02T12:00:00.000Z'));
    const shift = {
      id: 2,
      name: 'Day',
      type: 'FIXED',
      startTime: '09:00',
      endTime: '17:00',
      requiredHours: 8,
      minPresentHours: 5,
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
    };
    prisma.employee.findMany.mockResolvedValue([
      { id: 4, organizationId: 1, shift },
    ]);
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.attendance.create.mockResolvedValue({ id: 301 });

    await service.runDailyAutomation();

    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: AttendanceStatus.WEEKLY_OFF,
        }),
      }),
    );
  });

  it('credits an assigned shoot day instead of creating an absence', async () => {
    jest.setSystemTime(new Date('2026-03-03T12:00:00.000Z'));
    const shift = {
      id: 2,
      name: 'Day',
      type: 'FIXED',
      startTime: '09:00',
      endTime: '17:00',
      requiredHours: 8,
      minPresentHours: 5,
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
      workingDays: [1, 2, 3, 4, 5],
    };
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 4,
        organizationId: 1,
        shift,
        shiftAssignments: [],
        organization: { timezone: 'UTC' },
      },
    ]);
    prisma.taskCrewAssignment.findFirst.mockResolvedValue({ id: 92 });
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.attendance.create.mockImplementation(async ({ data }: any) => ({
      id: 302,
      ...data,
    }));

    await service.runDailyAutomation();

    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: AttendanceStatus.PRESENT,
          isShootDay: true,
        }),
      }),
    );
    expect(prisma.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AttendanceStatus.PRESENT,
          isShootDay: true,
        }),
      }),
    );
  });

  it('converts scheduled shoot attendance to present when the shoot date is due', async () => {
    jest.setSystemTime(new Date('2026-03-03T12:00:00.000Z'));
    const shift = {
      id: 2,
      name: 'Day',
      type: 'FIXED',
      startTime: '09:00',
      endTime: '17:00',
      requiredHours: 8,
      minPresentHours: 5,
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
      workingDays: [1, 2, 3, 4, 5],
    };
    const scheduledAttendance = {
      id: 303,
      employeeId: 4,
      date: new Date('2026-03-02T00:00:00.000Z'),
      status: AttendanceStatus.UPCOMING,
      isShootDay: true,
      checkIn: null,
      checkOut: null,
      shift,
      breaks: [],
    };
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 4,
        organizationId: 1,
        shift,
        shiftAssignments: [],
        organization: { timezone: 'UTC' },
      },
    ]);
    prisma.taskCrewAssignment.findFirst.mockResolvedValue({ id: 92 });
    prisma.attendance.findUnique.mockResolvedValue(scheduledAttendance);
    prisma.attendance.update.mockResolvedValue({
      ...scheduledAttendance,
      status: AttendanceStatus.PRESENT,
    });

    await service.runDailyAutomation();

    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 303 },
        data: expect.objectContaining({
          status: AttendanceStatus.PRESENT,
          isShootDay: true,
        }),
      }),
    );
  });

  it('does not generate absent attendance rows for flexible employees', async () => {
    jest.setSystemTime(new Date('2026-03-02T12:00:00.000Z'));
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 4,
        organizationId: 1,
        shift: { id: 2, type: 'FLEXIBLE', requiredHours: 8 },
        shiftAssignments: [],
        organization: { timezone: 'UTC' },
      },
    ]);

    await service.runDailyAutomation();

    expect(prisma.attendance.upsert).not.toHaveBeenCalled();
    expect(prisma.attendance.create).not.toHaveBeenCalled();
  });

  it('does not create automated attendance before the hire date', async () => {
    jest.setSystemTime(new Date('2026-03-14T12:00:00.000Z'));
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 8,
        organizationId: 1,
        hireDate: new Date('2026-03-14T00:00:00.000Z'),
        shift: {
          id: 2,
          name: 'Day',
          type: 'FIXED',
          startTime: '09:00',
          endTime: '17:00',
          requiredHours: 8,
          minPresentHours: 5,
          gracePeriodMinutes: 15,
          weeklyHolidayDay: 0,
        },
      },
    ]);

    await service.runDailyAutomation();

    expect(prisma.attendance.create).not.toHaveBeenCalled();
    expect(prisma.attendance.findUnique).not.toHaveBeenCalled();
  });

  it('auto-closes missed checkout and its timer at local midnight, closing an open break', async () => {
    const now = new Date('2026-03-14T12:00:00.000Z');
    jest.setSystemTime(now);
    const shift = {
      id: 2,
      name: 'Night',
      type: 'FIXED',
      startTime: '21:00',
      endTime: '05:00',
      requiredHours: 8,
      minPresentHours: 5,
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
    };
    const checkIn = new Date('2026-03-13T21:00:00.000Z');
    const breakStart = new Date(checkIn.getTime() + 4 * 60 * 60 * 1000);
    const targetDate = new Date('2026-03-13T00:00:00.000Z');
    prisma.employee.findMany.mockResolvedValue([
      { id: 7, organizationId: 1, shift },
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 88,
        employeeId: 7,
        organizationId: 1,
        date: targetDate,
        checkIn,
        checkOut: null,
        status: AttendanceStatus.PRESENT,
        lateMinutes: 0,
        shift,
        breaks: [{ id: 12, startedAt: breakStart, endedAt: null }],
        employee: {
          shift,
          organization: { timezone: 'UTC' },
        },
      },
    ]);
    prisma.attendance.findUnique.mockResolvedValue({
      id: 88,
      employeeId: 7,
      date: targetDate,
      checkIn,
      checkOut: null,
      status: AttendanceStatus.PRESENT,
      lateMinutes: 0,
      breaks: [{ id: 12, startedAt: breakStart, endedAt: null }],
    });

    await service.runDailyAutomation();

    const autoCheckOut = new Date('2026-03-14T00:00:00.000Z');
    expect(mockTasksService.stopActiveTimerForEmployee).toHaveBeenCalledWith(
      7,
      1,
      autoCheckOut,
      prisma,
    );
    expect(prisma.attendanceBreak.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { endedAt: autoCheckOut },
    });
    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 88 },
        data: expect.objectContaining({
          checkOut: autoCheckOut,
          isAutoClosed: true,
          checkoutSource: 'AUTO',
          checkoutActorId: null,
        }),
      }),
    );
  });

  it('leaves a same-day attendance open until the local date advances', async () => {
    jest.setSystemTime(new Date('2026-03-13T23:59:00.000Z'));
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 91,
        employeeId: 7,
        organizationId: 1,
        date: new Date('2026-03-13T00:00:00.000Z'),
        checkIn: new Date('2026-03-13T09:00:00.000Z'),
        checkOut: null,
        lateMinutes: 0,
        breaks: [],
        shift: null,
        employee: {
          organization: { timezone: 'UTC' },
          shift: {
            id: 1,
            name: 'Day',
            type: 'FIXED',
            startTime: '09:00',
            endTime: '17:00',
            requiredHours: 8,
            minPresentHours: 5,
            gracePeriodMinutes: 15,
            weeklyHolidayDay: 0,
          },
        },
      },
    ]);

    await service.runDailyAutomation();

    expect(mockTasksService.stopActiveTimerForEmployee).not.toHaveBeenCalled();
    expect(prisma.attendance.update).not.toHaveBeenCalled();
  });

  it('auto-closes at midnight in the organization timezone', async () => {
    jest.setSystemTime(new Date('2026-03-14T00:00:00.000Z'));
    const checkIn = new Date('2026-03-13T09:00:00.000Z');
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 92,
        employeeId: 7,
        organizationId: 1,
        date: new Date('2026-03-13T00:00:00.000Z'),
        checkIn,
        checkOut: null,
        lateMinutes: 0,
        breaks: [],
        shift: null,
        employee: {
          organization: { timezone: 'Asia/Kolkata' },
          shift: {
            id: 1,
            name: 'Day',
            type: 'FIXED',
            startTime: '09:00',
            endTime: '17:00',
            requiredHours: 8,
            minPresentHours: 5,
            gracePeriodMinutes: 15,
            weeklyHolidayDay: 0,
          },
        },
      },
    ]);

    await service.runAutoCheckoutAutomation();

    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 92 },
        data: expect.objectContaining({
          checkOut: new Date('2026-03-13T18:30:00.000Z'),
          isAutoClosed: true,
        }),
      }),
    );
  });
});
