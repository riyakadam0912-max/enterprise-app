import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  attendanceDateFromKey,
  dateKeyInTimezone,
  localMidnightAfterDateInTimezone,
  localMidnightAtDateInTimezone,
} from '../attendance/attendance-time.utils';

@Injectable()
export class AttendanceTaskHoursService {
  async recomputeTimesheetHours(
    employeeId: number,
    organizationId: number,
    timesheetDate: Date,
    transaction: Prisma.TransactionClient,
  ) {
    const organization = await transaction.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    });
    if (!organization) {
      throw new BadRequestException(
        'The employee organization is unavailable for attendance tracking',
      );
    }

    const timezone = organization.timezone ?? 'UTC';
    const dateKey = dateKeyInTimezone(timesheetDate, timezone);
    const date = attendanceDateFromKey(dateKey);
    const nextDate = new Date(date.getTime() + 86_400_000);
    const dayStart = localMidnightAtDateInTimezone(dateKey, timezone);
    const dayEnd = localMidnightAfterDateInTimezone(dateKey, timezone);
    if (!dayStart || !dayEnd || dayEnd <= dayStart) {
      throw new BadRequestException(
        'Unable to calculate task time for the employee organization timezone',
      );
    }
    const dayNumber = Math.floor(date.getTime() / 86_400_000);

    await transaction.$queryRaw<Array<{ locked: number }>>`
      WITH lock_result AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(
          ${employeeId}::integer,
          ${dayNumber}::integer
        )
      )
      SELECT 1 AS locked
      FROM lock_result
    `;

    const employee = await transaction.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: {
        shiftId: true,
        shift: { select: { requiredHours: true } },
        shiftAssignments: {
          where: {
            effectiveFrom: { lte: date },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          select: {
            shiftId: true,
            shift: { select: { requiredHours: true } },
          },
        },
      },
    });
    if (!employee) {
      throw new BadRequestException(
        'The selected employee is unavailable for attendance tracking',
      );
    }

    const [timesheetHours, timerIntervals, timerTimesheets] =
      await Promise.all([
        transaction.timesheet.aggregate({
          where: {
            employeeId,
            organizationId,
            date: { gte: date, lt: nextDate },
            source: { not: 'TASK_TIMER' },
            status: { not: 'REJECTED' },
            deletedAt: null,
          },
          _sum: { hours: true },
        }),
        transaction.taskTimerInterval.findMany({
          where: {
            timerSession: { user: { employeeId } },
            startedAt: { lt: dayEnd },
            endedAt: { gt: dayStart },
          },
          select: { startedAt: true, endedAt: true },
        }),
        transaction.timesheet.findMany({
          where: {
            employeeId,
            organizationId,
            date: {
              gte: new Date(date.getTime() - 86_400_000),
              lt: new Date(nextDate.getTime() + 86_400_000),
            },
            source: 'TASK_TIMER',
            status: { not: 'REJECTED' },
            deletedAt: null,
          },
          select: {
            date: true,
            hours: true,
            timerSession: {
              select: { intervals: { select: { id: true } } },
            },
          },
        }),
      ]);

    const intervalHours = timerIntervals.reduce((total, interval) => {
      const overlapStart = Math.max(
        interval.startedAt.getTime(),
        dayStart.getTime(),
      );
      const overlapEnd = Math.min(
        interval.endedAt.getTime(),
        dayEnd.getTime(),
      );
      return total + Math.max(0, overlapEnd - overlapStart) / 3_600_000;
    }, 0);
    const legacyTimerHours = timerTimesheets
      .filter(
        (timesheet) =>
          dateKeyInTimezone(timesheet.date, timezone) === dateKey &&
          (!timesheet.timerSession ||
            timesheet.timerSession.intervals.length === 0),
      )
      .reduce((total, timesheet) => total + timesheet.hours, 0);
    const taskHours =
      (timesheetHours._sum.hours ?? 0) + intervalHours + legacyTimerHours;
    const shiftAssignment = employee.shiftAssignments[0];

    await transaction.attendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: {
        employeeId,
        organizationId,
        date,
        shiftId: shiftAssignment?.shiftId ?? employee.shiftId,
        requiredHours:
          shiftAssignment?.shift.requiredHours ??
          employee.shift?.requiredHours,
        status: 'NOT_STARTED',
        taskHours,
      },
      update: { taskHours },
    });
  }
}
