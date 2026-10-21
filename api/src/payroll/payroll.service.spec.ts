import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PayrollService } from './payroll.service';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayslipGenerationService } from './payslip-generation.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockCacheManager,
  createMockPrismaService,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';
import { BusinessUnitsService } from '../business-units/business-units.service';

function createMockAuthUser(
  role: Role,
  overrides: Partial<AuthUser> = {},
): AuthUser {
  return {
    id: 1,
    userId: 1,
    email: 'test@example.com',
    name: 'Test User',
    role,
    roles: [role],
    permissions: [],
    employeeId: null,
    organizationId: 1,
    tokenType: 'Bearer',
    jti: null,
    ...overrides,
  };
}

describe('PayrollService', () => {
  let service: PayrollService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockPrisma.taskTimerInterval.findMany.mockResolvedValue([]);
    mockPrisma.timesheet.findMany.mockResolvedValue([]);
    mockPrisma.organization.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: PayrollCalculationService,
          useValue: { calculatePayroll: jest.fn() },
        },
        {
          provide: PayslipGenerationService,
          useValue: {
            generatePayslip: jest.fn(),
            generatePayslipHTML: jest.fn(),
          },
        },
        { provide: CACHE_MANAGER, useValue: createMockCacheManager() },
        {
          provide: BusinessUnitsService,
          useValue: {
            resolveScope: jest.fn().mockResolvedValue({
              allUnits: true,
              unitIds: [],
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
  });

  function mockPayrollEmployee() {
    mockPrisma.employee.findFirst.mockResolvedValue({
      hireDate: null,
      shift: {
        type: 'FIXED',
        requiredHours: 8,
        weeklyHolidayDay: 0,
        workingDays: [1, 2, 3, 4, 5],
      },
      shiftAssignments: [],
      organization: { timezone: 'UTC' },
    });
  }

  it('should throw ConflictException when a payroll cycle already exists for the same month and year', async () => {
    const user = createMockAuthUser(Role.ADMIN);
    mockPrisma.payrollCycle.findFirst.mockResolvedValueOnce({
      id: 99,
      month: 8,
      year: 2026,
    });

    await expect(
      service.createCycle(
        { name: 'August Payroll', month: 8, year: 2026, notes: '' },
        user,
      ),
    ).rejects.toThrow(ConflictException);

    expect(mockPrisma.payrollCycle.create).not.toHaveBeenCalled();
  });

  it('calculates expected hours from scheduled workdays in the payroll month', async () => {
    mockPayrollEmployee();
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        date: new Date('2026-08-03T00:00:00.000Z'),
        status: 'PRESENT',
        workingHours: 5,
        requiredHours: 8,
        overtimeHours: 0,
        lateMinutes: 0,
      },
      {
        date: new Date('2026-08-04T00:00:00.000Z'),
        status: 'PRESENT',
        workingHours: 10,
        requiredHours: 8,
        overtimeHours: 2,
        lateMinutes: 0,
      },
    ]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    const metrics = await (service as any).getAttendanceMetricsForCycle(
      7,
      8,
      2026,
      1,
    );

    expect(metrics.totalWorkedHours).toBe(15);
    expect(metrics.totalWorkingDays).toBe(21);
    expect(metrics.totalExpectedHours).toBe(168);
    expect(metrics.totalShortfallHours).toBe(153);
    expect(metrics.overtimeHours).toBe(2);
  });

  it('counts half-day leave as half a scheduled payroll day', async () => {
    mockPayrollEmployee();
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        date: new Date('2026-08-10T00:00:00.000Z'),
        status: 'PRESENT',
        workingHours: 5,
        requiredHours: 8,
      },
      {
        date: new Date('2026-08-11T00:00:00.000Z'),
        status: 'PRESENT',
        workingHours: 5,
        requiredHours: 8,
      },
    ]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([
      {
        startDate: new Date('2026-08-10T00:00:00.000Z'),
        endDate: new Date('2026-08-10T00:00:00.000Z'),
        duration: 'HALF_DAY',
        isPaid: true,
      },
      {
        startDate: new Date('2026-08-11T00:00:00.000Z'),
        endDate: new Date('2026-08-11T00:00:00.000Z'),
        duration: 'HALF_DAY',
        isPaid: false,
      },
    ]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    const metrics = await (service as any).getAttendanceMetricsForCycle(
      7,
      8,
      2026,
      1,
    );

    expect(metrics.paidLeaves).toBe(0.5);
    expect(metrics.unpaidLeaves).toBe(0.5);
    expect(metrics.totalWorkingDays).toBe(20);
    expect(metrics.totalExpectedHours).toBe(160);
    expect(metrics.totalShortfallHours).toBe(150);
  });

  it('counts a multi-date half-day range per date in payroll', async () => {
    mockPayrollEmployee();
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        date: new Date('2026-08-10T00:00:00.000Z'),
        status: 'PRESENT',
        workingHours: 5,
        requiredHours: 8,
      },
      {
        date: new Date('2026-08-11T00:00:00.000Z'),
        status: 'PRESENT',
        workingHours: 5,
        requiredHours: 8,
      },
    ]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([
      {
        startDate: new Date('2026-08-10T00:00:00.000Z'),
        endDate: new Date('2026-08-11T00:00:00.000Z'),
        duration: 'HALF_DAY',
        isPaid: true,
      },
    ]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    const metrics = await (service as any).getAttendanceMetricsForCycle(
      7,
      8,
      2026,
      1,
    );

    expect(metrics.paidLeaves).toBe(1);
    expect(metrics.totalWorkingDays).toBe(20);
    expect(metrics.totalExpectedHours).toBe(160);
    expect(metrics.totalShortfallHours).toBe(150);
  });

  it('uses flexible task time only on scheduled non-holiday dates', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({
      hireDate: null,
      shift: {
        type: 'FLEXIBLE',
        requiredHours: 6,
        weeklyHolidayDay: 0,
        workingDays: [1, 2, 3, 4, 5],
      },
      shiftAssignments: [],
      organization: { timezone: 'UTC' },
    });
    mockPrisma.attendance.findMany.mockResolvedValue([]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.holiday.findMany.mockResolvedValue([
      {
        organizationId: 1,
        familyRootOrganizationId: 1,
        startDate: new Date('2026-10-20T00:00:00.000Z'),
        endDate: new Date('2026-10-20T00:00:00.000Z'),
      },
    ]);
    mockPrisma.organization.findMany.mockResolvedValue([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
    ]);
    mockPrisma.taskTimerInterval.findMany.mockResolvedValue([
      {
        startedAt: new Date('2026-10-19T08:00:00.000Z'),
        endedAt: new Date('2026-10-19T10:00:00.000Z'),
      },
      {
        startedAt: new Date('2026-10-18T08:00:00.000Z'),
        endedAt: new Date('2026-10-18T13:00:00.000Z'),
      },
    ]);
    mockPrisma.timesheet.findMany.mockResolvedValue([
      { date: new Date('2026-10-19T00:00:00.000Z'), hours: 2 },
      { date: new Date('2026-10-17T00:00:00.000Z'), hours: 5 },
    ]);

    const metrics = await (service as any).getAttendanceMetricsForCycle(
      7,
      10,
      2026,
      2,
    );

    expect(metrics.totalWorkingDays).toBe(21);
    expect(metrics.totalExpectedHours).toBe(168);
    expect(metrics.presentDays).toBe(0.5);
    expect(metrics.totalWorkedHours).toBe(4);
  });

  it('uses the default weekday schedule when an employee has no shift', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({
      hireDate: null,
      shift: null,
      shiftAssignments: [],
      organization: { timezone: 'UTC' },
    });
    mockPrisma.attendance.findMany.mockResolvedValue([]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    const metrics = await (service as any).getAttendanceMetricsForCycle(
      7,
      10,
      2026,
      1,
    );

    expect(metrics.totalWorkingDays).toBe(22);
    expect(metrics.totalExpectedHours).toBe(176);
  });
});
