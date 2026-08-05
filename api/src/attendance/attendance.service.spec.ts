import { ConflictException, ForbiddenException } from '@nestjs/common';
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
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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

  beforeEach(() => {
    jest.useFakeTimers();
    prisma = createPrismaMock();
    cacheManager = createCacheManagerMock();
    mockUser = createMockUser();
    service = new AttendanceService(
      prisma as unknown as PrismaService,
      cacheManager as unknown as Cache,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
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

  it('builds the daily attendance table with absent and leave statuses', async () => {
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
      expect.objectContaining({ present: 1, absent: 1, leave: 1, halfDay: 0 }),
    );
    expect(result.rows.map((row) => [row.employee.name, row.status])).toEqual([
      ['Ava', AttendanceStatus.PRESENT],
      ['Ben', AttendanceStatus.LEAVE],
      ['Cara', AttendanceStatus.ABSENT],
    ]);
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
    expect(result.days[2].status).toBe(AttendanceStatus.LEAVE);
    expect(result.summary.present).toBeGreaterThanOrEqual(1);
    expect(result.summary.leave).toBeGreaterThanOrEqual(1);
  });
});
