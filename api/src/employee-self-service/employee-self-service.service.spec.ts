import { Test, TestingModule } from '@nestjs/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { EmployeeSelfServiceService } from './employee-self-service.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/types/auth';
import {
  createMockPrismaService,
  getMockPrismaDelegate,
} from '../../test/helpers/mocks.helper';
import { LeaveRequestsService } from '../leave-requests/leave-requests.service';
import { LeaveEntitlementsService } from '../leave-requests/leave-entitlements.service';
import { TasksService } from '../tasks/tasks.service';
import { AttendanceService } from '../attendance/attendance.service';

describe('EmployeeSelfServiceService', () => {
  let service: EmployeeSelfServiceService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockLeaveRequests: { create: jest.Mock };
  let mockLeaveEntitlements: {
    countScheduledLeaveDays: jest.Mock;
    getBalance: jest.Mock;
  };
  let mockTasksService: { stopActiveTimerForEmployee: jest.Mock };
  let mockAttendanceService: {
    checkIn: jest.Mock;
    checkOut: jest.Mock;
  };

  const createUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
    id: 7,
    userId: 7,
    email: 'abc@gmail.com',
    name: 'Employee User',
    role: Role.EMPLOYEE,
    roles: [Role.EMPLOYEE],
    permissions: [],
    employeeId: null,
    organizationId: 2,
    tokenType: 'access',
    jti: null,
    ...overrides,
  });

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockLeaveRequests = {
      create: jest.fn().mockResolvedValue({
        id: 5,
        leaveType: 'CASUAL',
        startDate: new Date('2026-08-10T00:00:00.000Z'),
        endDate: new Date('2026-08-12T00:00:00.000Z'),
        duration: 'HALF_DAY',
        status: 'PENDING_MANAGER',
      } as never),
    };
    mockLeaveEntitlements = {
      countScheduledLeaveDays: jest.fn().mockResolvedValue(1.5 as never),
      getBalance: jest.fn().mockResolvedValue({
        totalAllocation: 1.5,
        daysTaken: 0,
        balance: 1.5,
        compOffAvailable: 0,
        year: 2026,
      } as never),
    };
    mockTasksService = {
      stopActiveTimerForEmployee: jest.fn().mockResolvedValue(null as never),
    };
    mockAttendanceService = {
      checkIn: jest.fn(),
      checkOut: jest.fn(),
    };
    mockPrisma.$transaction.mockImplementation(
      (operation: (tx: typeof mockPrisma) => unknown) => operation(mockPrisma),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeSelfServiceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LeaveRequestsService, useValue: mockLeaveRequests },
        { provide: LeaveEntitlementsService, useValue: mockLeaveEntitlements },
        { provide: TasksService, useValue: mockTasksService },
        { provide: AttendanceService, useValue: mockAttendanceService },
      ],
    }).compile();

    service = module.get<EmployeeSelfServiceService>(
      EmployeeSelfServiceService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('accepts a multi-date half-day request and reports half a day per date', async () => {
    const user = createUser({ employeeId: 22 });
    const employeeDelegate = getMockPrismaDelegate(mockPrisma, 'employee');
    employeeDelegate.findFirst.mockResolvedValue({ id: 22 });

    const result = await service.applyLeave(user, {
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      duration: 'HALF_DAY',
      leaveType: 'CASUAL',
    });

    expect(result.data.days).toBe(1.5);
    expect(result.data.status).toBe('PENDING_MANAGER');
    expect(mockLeaveRequests.create).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-08-10',
        endDate: '2026-08-12',
        duration: 'HALF_DAY',
        leaveType: 'CASUAL',
        employeeId: 22,
      }),
      user,
    );
  });

  it('resolves a linked employee only within the current organization and active records', async () => {
    const user = createUser();
    const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');
    const employeeDelegate = getMockPrismaDelegate(mockPrisma, 'employee');

    userDelegate.findUnique.mockResolvedValue({
      id: user.id,
      organizationId: 2,
    });
    employeeDelegate.findFirst.mockResolvedValue({
      id: 22,
      email: user.email,
      organizationId: 2,
      deletedAt: null,
    });
    userDelegate.update.mockResolvedValue({
      id: user.id,
      employeeId: 22,
      organizationId: 2,
    });

    const result = await (service as any).resolveEmployeeId(user);

    expect(result).toBe(22);
    expect(employeeDelegate.findFirst).toHaveBeenCalledWith({
      where: {
        email: user.email,
        organizationId: 2,
        deletedAt: null,
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    expect(userDelegate.update).toHaveBeenCalledWith({
      where: { id: user.userId || user.id },
      data: { employeeId: 22 },
    });
  });

  it('records ESS check-ins late according to the organization timezone', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-13T03:46:00.000Z'));
    const user = createUser({ employeeId: 22 });
    const employeeDelegate = getMockPrismaDelegate(mockPrisma, 'employee');
    const organizationDelegate = getMockPrismaDelegate(
      mockPrisma,
      'organization',
    );
    const shiftDelegate = getMockPrismaDelegate(mockPrisma, 'shift');
    const attendanceDelegate = getMockPrismaDelegate(mockPrisma, 'attendance');

    employeeDelegate.findFirst.mockResolvedValue({ id: 22 });
    employeeDelegate.findUnique.mockResolvedValue({ id: 22, shiftId: 5 });
    organizationDelegate.findUnique.mockResolvedValue({
      timezone: 'Asia/Kolkata',
    });
    attendanceDelegate.findUnique.mockResolvedValue(null);
    shiftDelegate.findUnique.mockResolvedValue({
      type: 'FIXED',
      name: 'Day',
      startTime: '09:00',
      endTime: '17:00',
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
    });
    attendanceDelegate.upsert.mockResolvedValue({
      checkIn: new Date('2026-03-13T03:46:00.000Z'),
      lateMinutes: 1,
    });

    const result = await service.checkIn(user);

    expect(attendanceDelegate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          date: new Date('2026-03-13T00:00:00.000Z'),
          lateMinutes: 1,
          status: 'PRESENT',
        }),
      }),
    );
    expect(result.data.lateMinutes).toBe(1);
  });

  it('sets ESS half-day status from hours worked at checkout', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-13T06:46:00.000Z'));
    const user = createUser({ employeeId: 22 });
    const employeeDelegate = getMockPrismaDelegate(mockPrisma, 'employee');
    const organizationDelegate = getMockPrismaDelegate(
      mockPrisma,
      'organization',
    );
    const attendanceDelegate = getMockPrismaDelegate(mockPrisma, 'attendance');

    employeeDelegate.findFirst.mockResolvedValue({ id: 22 });
    employeeDelegate.findUnique.mockResolvedValue({ id: 22 });
    organizationDelegate.findUnique.mockResolvedValue({
      timezone: 'Asia/Kolkata',
    });
    attendanceDelegate.findUnique.mockResolvedValue({
      id: 4,
      checkIn: new Date('2026-03-13T03:46:00.000Z'),
      checkOut: null,
      shift: { requiredHours: 8, minPresentHours: 5 },
      breaks: [],
    });
    attendanceDelegate.update.mockResolvedValue({
      checkIn: new Date('2026-03-13T03:46:00.000Z'),
      checkOut: new Date('2026-03-13T06:46:00.000Z'),
      workingHours: 3,
      overtimeHours: 0,
      lateMinutes: 1,
    });

    await service.checkOut(user);

    expect(attendanceDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workingHours: 3,
          status: 'HALF_DAY',
          shortfallHours: 5,
          checkoutSource: 'USER',
          checkoutActorId: user.userId,
        }),
      }),
    );
    expect(mockTasksService.stopActiveTimerForEmployee).toHaveBeenCalledWith(
      22,
      2,
      new Date('2026-03-13T06:46:00.000Z'),
      mockPrisma,
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('closes an open break and finalizes the task timer in the checkout transaction', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-13T06:46:00.000Z'));
    const user = createUser({ employeeId: 22 });
    const employeeDelegate = getMockPrismaDelegate(mockPrisma, 'employee');
    const organizationDelegate = getMockPrismaDelegate(
      mockPrisma,
      'organization',
    );
    const attendanceDelegate = getMockPrismaDelegate(mockPrisma, 'attendance');
    const attendanceBreakDelegate = getMockPrismaDelegate(
      mockPrisma,
      'attendanceBreak',
    );

    employeeDelegate.findFirst.mockResolvedValue({ id: 22 });
    employeeDelegate.findUnique.mockResolvedValue({ id: 22 });
    organizationDelegate.findUnique.mockResolvedValue({ timezone: 'UTC' });
    attendanceDelegate.findUnique.mockResolvedValue({
      id: 4,
      checkIn: new Date('2026-03-13T03:46:00.000Z'),
      checkOut: null,
      shift: { requiredHours: 8, minPresentHours: 5 },
      breaks: [
        {
          id: 6,
          startedAt: new Date('2026-03-13T05:46:00.000Z'),
          endedAt: null,
        },
      ],
    });
    attendanceDelegate.update.mockResolvedValue({
      checkIn: new Date('2026-03-13T03:46:00.000Z'),
      checkOut: new Date('2026-03-13T06:46:00.000Z'),
      workingHours: 2,
      overtimeHours: 0,
      lateMinutes: 1,
    });

    await service.checkOut(user);

    expect(attendanceBreakDelegate.update).toHaveBeenCalledWith({
      where: { id: 6 },
      data: { endedAt: new Date('2026-03-13T06:46:00.000Z') },
    });
    expect(mockTasksService.stopActiveTimerForEmployee).toHaveBeenCalledWith(
      22,
      2,
      new Date('2026-03-13T06:46:00.000Z'),
      mockPrisma,
    );
    expect(attendanceDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workingHours: 2,
          shortfallHours: 6,
        }),
      }),
    );
  });

  it('does not save self-service checkout when the task timer cannot be finalized', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-13T06:46:00.000Z'));
    const user = createUser({ employeeId: 22 });
    const employeeDelegate = getMockPrismaDelegate(mockPrisma, 'employee');
    const organizationDelegate = getMockPrismaDelegate(
      mockPrisma,
      'organization',
    );
    const attendanceDelegate = getMockPrismaDelegate(mockPrisma, 'attendance');

    employeeDelegate.findFirst.mockResolvedValue({ id: 22 });
    employeeDelegate.findUnique.mockResolvedValue({ id: 22 });
    organizationDelegate.findUnique.mockResolvedValue({ timezone: 'UTC' });
    attendanceDelegate.findUnique.mockResolvedValue({
      id: 4,
      checkIn: new Date('2026-03-13T03:46:00.000Z'),
      checkOut: null,
      shift: { requiredHours: 8, minPresentHours: 5 },
      breaks: [],
    });
    mockTasksService.stopActiveTimerForEmployee.mockImplementationOnce(
      async () => {
        throw new Error('timer write failed');
      },
    );

    await expect(service.checkOut(user)).rejects.toThrow('timer write failed');

    expect(attendanceDelegate.update).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('loads today attendance using the organization timezone', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-12T19:00:00.000Z'));
    const user = createUser({ employeeId: 22 });
    const employeeDelegate = getMockPrismaDelegate(mockPrisma, 'employee');
    const organizationDelegate = getMockPrismaDelegate(
      mockPrisma,
      'organization',
    );
    const attendanceDelegate = getMockPrismaDelegate(mockPrisma, 'attendance');

    employeeDelegate.findFirst.mockResolvedValue({ id: 22 });
    organizationDelegate.findUnique.mockResolvedValue({
      timezone: 'Asia/Kolkata',
    });
    attendanceDelegate.findUnique.mockResolvedValue(null);
    employeeDelegate.findUnique.mockResolvedValue({ id: 22, shift: null });

    await service.getMyAttendanceToday(user);

    expect(attendanceDelegate.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employeeId_date: {
            employeeId: 22,
            date: new Date('2026-03-13T00:00:00.000Z'),
          },
        },
      }),
    );
  });
});
