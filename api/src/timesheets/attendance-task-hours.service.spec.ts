import { BadRequestException } from '@nestjs/common';
import { AttendanceTaskHoursService } from './attendance-task-hours.service';

describe('AttendanceTaskHoursService', () => {
  const transaction = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    employee: { findFirst: jest.fn() },
    timesheet: { aggregate: jest.fn() },
    attendance: { upsert: jest.fn() },
  };
  const service = new AttendanceTaskHoursService();
  const timesheetDate = new Date('2026-10-19T18:30:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.employee.findFirst.mockResolvedValue({
      shiftId: 4,
      shift: { requiredHours: 8 },
      shiftAssignments: [],
    });
    transaction.timesheet.aggregate.mockResolvedValue({
      _sum: { hours: 2.5 },
    });
  });

  it('recomputes eligible hours and creates an attendance shell for the date', async () => {
    await service.recomputeTimesheetHours(
      101,
      3,
      timesheetDate,
      transaction as never,
    );

    expect(transaction.$executeRaw).toHaveBeenCalled();
    expect(transaction.timesheet.aggregate).toHaveBeenCalledWith({
      where: {
        employeeId: 101,
        organizationId: 3,
        date: {
          gte: new Date('2026-10-19T00:00:00.000Z'),
          lt: new Date('2026-10-20T00:00:00.000Z'),
        },
        status: { not: 'REJECTED' },
        deletedAt: null,
      },
      _sum: { hours: true },
    });
    expect(transaction.attendance.upsert).toHaveBeenCalledWith({
      where: {
        employeeId_date: {
          employeeId: 101,
          date: new Date('2026-10-19T00:00:00.000Z'),
        },
      },
      create: expect.objectContaining({
        employeeId: 101,
        organizationId: 3,
        shiftId: 4,
        requiredHours: 8,
        status: 'NOT_STARTED',
        taskHours: 2.5,
      }),
      update: { taskHours: 2.5 },
    });
  });

  it('uses the effective historical shift for the timesheet date', async () => {
    transaction.employee.findFirst.mockResolvedValueOnce({
      shiftId: 4,
      shift: { requiredHours: 8 },
      shiftAssignments: [{ shiftId: 7, shift: { requiredHours: 6 } }],
    });

    await service.recomputeTimesheetHours(
      101,
      3,
      timesheetDate,
      transaction as never,
    );

    expect(transaction.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ shiftId: 7, requiredHours: 6 }),
      }),
    );
  });

  it('sets task hours to zero when no eligible timesheets remain', async () => {
    transaction.timesheet.aggregate.mockResolvedValueOnce({
      _sum: { hours: null },
    });

    await service.recomputeTimesheetHours(
      101,
      3,
      timesheetDate,
      transaction as never,
    );

    expect(transaction.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ taskHours: 0 }),
        update: { taskHours: 0 },
      }),
    );
  });

  it('rejects an employee outside the organization', async () => {
    transaction.employee.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.recomputeTimesheetHours(
        101,
        3,
        timesheetDate,
        transaction as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.attendance.upsert).not.toHaveBeenCalled();
  });
});
