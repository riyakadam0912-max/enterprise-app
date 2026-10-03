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
  return {
    employee: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    attendance: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    attendanceBreak: {
      create: jest.fn(),
      update: jest.fn(),
    },
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
      findMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
  };
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
    };
    service = new AttendanceService(
      prisma as unknown as PrismaService,
      cacheManager as unknown as Cache,
      mockBusinessUnitsService,
      mockOrganizationScopeService as any,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
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

  it('allows a super admin to create a holiday for the active organization', async () => {
    prisma.holiday.create.mockResolvedValue({
      id: 3,
      organizationId: 42,
      startDate: new Date('2026-10-02T00:00:00.000Z'),
      endDate: new Date('2026-10-03T00:00:00.000Z'),
      name: 'Founders Day',
    });

    const result = await service.createHoliday(
      { startDate: '2026-10-02', endDate: '2026-10-03', name: ' Founders Day ' },
      { ...mockUser, role: Role.SUPER_ADMIN, organizationId: 42 },
    );

    expect(prisma.holiday.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 42,
        startDate: { lte: new Date('2026-10-03T00:00:00.000Z') },
        endDate: { gte: new Date('2026-10-02T00:00:00.000Z') },
      }),
    }));
    expect(prisma.holiday.create).toHaveBeenCalledWith({
      data: {
        organizationId: 42,
        startDate: new Date('2026-10-02T00:00:00.000Z'),
        endDate: new Date('2026-10-03T00:00:00.000Z'),
        name: 'Founders Day',
      },
    });
    expect(result.name).toBe('Founders Day');
  });

  it('rejects overlapping corporate holiday ranges', async () => {
    prisma.holiday.findFirst.mockResolvedValue({ id: 8 });

    await expect(service.createHoliday(
      { startDate: '2026-10-03', endDate: '2026-10-05', name: 'Festival break' },
      { ...mockUser, role: Role.ADMIN },
    )).rejects.toThrow('This holiday range overlaps another corporate holiday');

    expect(prisma.holiday.create).not.toHaveBeenCalled();
  });

  it('allows an employee to check in once per day', async () => {
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
  });

  it('allows Sunday catch-up check-in while work hours remain outstanding', async () => {
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
    prisma.attendance.create.mockResolvedValue({ id: 3, status: AttendanceStatus.PRESENT });
    jest.spyOn(service as any, 'getWorkHourBalancesForEmployee').mockResolvedValue({
      week: { remainingHours: 2 },
      month: { remainingHours: 4 },
    });

    await service.checkIn({
      employeeId: 7,
      date: '2026-03-15',
      timestamp: '2026-03-15T09:00:00.000Z',
    }, mockUser);

    expect(prisma.attendance.create).toHaveBeenCalledTimes(1);
  });

  it('rejects Sunday catch-up check-in when weekly and monthly targets are complete', async () => {
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
    jest.spyOn(service as any, 'getWorkHourBalancesForEmployee').mockResolvedValue({
      week: { remainingHours: 0 },
      month: { remainingHours: 0 },
    });

    await expect(service.checkIn({
      employeeId: 7,
      date: '2026-03-15',
      timestamp: '2026-03-15T09:00:00.000Z',
    }, mockUser)).rejects.toThrow('Sunday catch-up is available only when scheduled hours are outstanding');

    expect(prisma.attendance.create).not.toHaveBeenCalled();
  });

  it('records late minutes using the organization timezone and includes them in the late count', async () => {
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
    prisma.organization.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' });
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
        }),
      }),
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
    expect(result.onBreak).toBe(true);
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
      expect.objectContaining({ where: { id: 1 }, data: { endedAt: expect.any(Date) } }),
    );
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

    const holidayRow = (service as any).toDailyRow(employee, day, null, false, 'Founders Day');
    const workedRow = (service as any).toDailyRow(
      employee,
      day,
      { id: 1, checkIn: new Date('2026-03-13T09:00:00.000Z'), checkOut: null, workingHours: null, lateMinutes: 0, overtimeHours: 0, shortfallHours: 0, status: AttendanceStatus.PRESENT },
      false,
      'Founders Day',
    );
    const leaveRow = (service as any).toDailyRow(employee, day, null, true, 'Founders Day');

    expect(holidayRow).toEqual(expect.objectContaining({ status: AttendanceStatus.HOLIDAY, holidayName: 'Founders Day' }));
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
    expect(result.totalWorkedHours).toBe(8.5);
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
    prisma.employee.findMany.mockResolvedValueOnce([{
        id: 7,
        name: 'Ava',
        hireDate: null,
        department: 'Sales',
        designation: 'Associate',
        organization: { id: 1, name: 'Main' },
        user: { role: 'EMPLOYEE' },
      }]);
    prisma.attendance.findMany.mockResolvedValue([{
      id: 11,
      employeeId: 7,
      date: new Date('2026-03-13T00:00:00.000Z'),
      checkIn: null,
      status: AttendanceStatus.ABSENT,
      lateMinutes: 0,
      overtimeHours: 0,
      workingHours: null,
      shift: null,
    }]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
    prisma.holiday.findMany.mockResolvedValue([{
      organizationId: 1,
      startDate: new Date('2026-03-13T00:00:00.000Z'),
      endDate: new Date('2026-03-14T00:00:00.000Z'),
      name: 'Founders Day',
    }]);

    const result = await service.getMonthlyReport(
      { year: 2026, month: 3 } as any,
      mockUser as any,
    );

    expect(result.rows[0]).toEqual(expect.objectContaining({
      absentCount: 0,
      holidayCount: 2,
      workingDays: 0,
      attendancePercent: 0,
    }));
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
        requiredHours: 24,
        completedHours: 8.5,
        breakHours: 0.5,
        remainingHours: 15.5,
      }),
    );
    expect(balances.month).toEqual(
      expect.objectContaining({
        requiredHours: 8,
        completedHours: 2.5,
        breakHours: 0.5,
        remainingHours: 5.5,
      }),
    );
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
    prisma.holiday.findMany.mockResolvedValue([{
      startDate: new Date('2026-03-13T00:00:00.000Z'),
      endDate: new Date('2026-03-14T00:00:00.000Z'),
      name: 'Founders Day',
    }]);

    const result = await service.getEmployeeAttendance(4, mockUser, '2026-03');

    expect(result.days[12]).toEqual(expect.objectContaining({
      status: AttendanceStatus.HOLIDAY,
      holidayName: 'Founders Day',
    }));
    expect(result.days[13]).toEqual(expect.objectContaining({
      status: AttendanceStatus.HOLIDAY,
      holidayName: 'Founders Day',
    }));
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

    expect(prisma.attendance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: AttendanceStatus.WEEKLY_OFF,
      }),
    });
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
});
