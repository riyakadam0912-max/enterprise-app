import type { PrismaService } from '../prisma/prisma.service';
import { getPayrollAttendanceMetrics } from './payroll-attendance.utils';

describe('getPayrollAttendanceMetrics work-from-home credit', () => {
  it('credits the first two scheduled WFH days fully and later days halfway without fabricating hours', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          hireDate: null,
          shift: {
            type: 'FIXED',
            requiredHours: 8,
            weeklyHolidayDay: 0,
            workingDays: [1, 2, 3, 4, 5],
          },
          shiftAssignments: [],
          organization: { timezone: 'UTC' },
        }),
      },
      attendance: { findMany: jest.fn().mockResolvedValue([]) },
      leaveRequest: {
        findMany: jest.fn().mockResolvedValue([
          {
            employeeId: 9,
            requestType: 'WORK_FROM_HOME',
            status: 'APPROVED',
            startDate: new Date('2026-10-01T00:00:00.000Z'),
            endDate: new Date('2026-10-05T00:00:00.000Z'),
            duration: 'FULL_DAY',
            isPaid: true,
          },
        ]),
      },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      timesheet: { findMany: jest.fn().mockResolvedValue([]) },
      organization: { findMany: jest.fn().mockResolvedValue([]) },
      taskTimerInterval: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const metrics = await getPayrollAttendanceMetrics(
      prisma,
      9,
      10,
      2026,
      1,
    );

    expect(metrics.presentDays).toBe(2.5);
    expect(metrics.totalWorkedHours).toBe(0);
    expect(metrics.paidLeaves).toBe(0);
    expect(metrics.unpaidLeaves).toBe(0);
  });

  it('caps paid leave at 1.5 days per calendar month and treats the remainder as unpaid', async () => {
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue({
        hireDate: null,
        shift: { type: 'FIXED', requiredHours: 8, weeklyHolidayDay: 0, workingDays: [1, 2, 3, 4, 5] },
        shiftAssignments: [],
        organization: { timezone: 'UTC' },
      }) },
      attendance: { findMany: jest.fn().mockResolvedValue([]) },
      leaveRequest: { findMany: jest.fn().mockResolvedValue([
        { employeeId: 9, requestType: 'LEAVE', status: 'APPROVED', startDate: new Date('2026-10-01T00:00:00.000Z'), endDate: new Date('2026-10-02T00:00:00.000Z'), duration: 'FULL_DAY', isPaid: true },
      ]) },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      timesheet: { findMany: jest.fn().mockResolvedValue([]) },
      organization: { findMany: jest.fn().mockResolvedValue([]) },
      taskTimerInterval: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const metrics = await getPayrollAttendanceMetrics(prisma, 9, 10, 2026, 1);
    expect(metrics.paidLeaves).toBe(1.5);
    expect(metrics.unpaidLeaves).toBe(0.5);
    expect(metrics.absentDays).toBe(0.5);
  });
});
