import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import {
  attendanceDateFromKey,
  localMidnightAfterDateInTimezone,
  localMidnightAtDateInTimezone,
} from '../attendance/attendance-time.utils';
import {
  getFlexibleTaskTimeCutoverDate,
  sumIntervalSeconds,
} from '../attendance/task-work-time.utils';
import {
  dayKey,
  isScheduledWorkday,
  resolveShiftForDate,
} from '../attendance/workday-schedule.utils';
import type { WorkdayShift } from '../attendance/workday-schedule.utils';
import { buildApprovedWorkFromHomeCredits } from '../attendance/work-from-home.utils';

export type PayrollAttendanceMetrics = {
  presentDays: number;
  absentDays: number;
  paidLeaves: number;
  unpaidLeaves: number;
  totalWorkingDays: number;
  lateCount: number;
  overtimeHours: number;
  totalWorkedHours: number;
  totalExpectedHours: number;
  totalShortfallHours: number;
};

const DEFAULT_PAYROLL_SHIFT: WorkdayShift = {
  type: 'FIXED',
  requiredHours: 8,
  weeklyHolidayDay: 0,
  workingDays: [1, 2, 3, 4, 5],
};

export async function getPayrollAttendanceMetrics(
  prisma: PrismaService,
  employeeId: number,
  month: number,
  year: number,
  organizationId: number,
): Promise<PayrollAttendanceMetrics> {
  const startKey = `${year}-${String(month).padStart(2, '0')}-01`;
  const startDate = attendanceDateFromKey(startKey);
  const nextMonthStart = attendanceDateFromKey(
    `${year}-${String(month).padStart(2, '0')}-01`,
  );
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
  const nextMonthKey = dayKey(nextMonthStart);
  const endDate = new Date(nextMonthStart.getTime() - 1);
  const [
    employee,
    attendanceRows,
    leaveRows,
    holidayRows,
    manualTimesheets,
    organizations,
  ] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: {
        hireDate: true,
        shift: true,
        shiftAssignments: { include: { shift: true } },
        organization: { select: { timezone: true } },
      },
    }),
    prisma.attendance.findMany({
      where: {
        deletedAt: null,
        employeeId,
        organizationId,
        date: { gte: startDate, lt: nextMonthStart },
      },
      include: { shift: true, breaks: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        deletedAt: null,
        employeeId,
        organizationId,
        status: 'APPROVED',
        startDate: { lt: nextMonthStart },
        endDate: { gte: startDate },
      },
    }),
    prisma.holiday.findMany({
      where: {
        startDate: { lt: nextMonthStart },
        endDate: { gte: startDate },
        OR: [{ organizationId }, { familyRootOrganizationId: { not: null } }],
      },
      select: {
        organizationId: true,
        familyRootOrganizationId: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.timesheet.findMany({
      where: {
        employeeId,
        organizationId,
        date: { gte: startDate, lt: nextMonthStart },
        source: { not: 'TASK_TIMER' },
        deletedAt: null,
      },
      select: { date: true, hours: true },
    }),
    prisma.organization.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, parentId: true },
    }),
  ]);

  if (!employee) {
    throw new NotFoundException('Employee not found for payroll attendance');
  }
  const ordinaryLeaveRows = leaveRows.filter(
    (request) => request.requestType !== 'WORK_FROM_HOME',
  );

  const timezone = employee.organization?.timezone ?? 'UTC';
  const rangeStart = localMidnightAtDateInTimezone(startKey, timezone);
  const rangeEnd = localMidnightAtDateInTimezone(nextMonthKey, timezone);
  if (!rangeStart || !rangeEnd) {
    throw new Error(
      'Unable to calculate payroll period in organization timezone',
    );
  }

  const taskIntervals = await prisma.taskTimerInterval.findMany({
    where: {
      timerSession: {
        organizationId,
        user: { employeeId },
      },
      startedAt: { lt: rangeEnd },
      endedAt: { gt: rangeStart },
    },
    select: { startedAt: true, endedAt: true },
  });
  const attendanceByDate = new Map(
    attendanceRows.map((row) => [dayKey(row.date), row]),
  );
  const organizationById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );
  let familyRootId = organizationId;
  const visitedOrganizationIds = new Set([organizationId]);
  while (organizationById.get(familyRootId)?.parentId != null) {
    const parentId = organizationById.get(familyRootId)!.parentId!;
    if (
      visitedOrganizationIds.has(parentId) ||
      !organizationById.has(parentId)
    ) {
      break;
    }
    visitedOrganizationIds.add(parentId);
    familyRootId = parentId;
  }
  const holidayKeys = new Set<string>();
  for (const holiday of holidayRows) {
    if (
      holiday.familyRootOrganizationId != null
        ? holiday.familyRootOrganizationId !== familyRootId
        : holiday.organizationId !== organizationId
    ) {
      continue;
    }
    for (
      const date = new Date(
        Math.max(holiday.startDate.getTime(), startDate.getTime()),
      );
      date <= new Date(Math.min(holiday.endDate.getTime(), endDate.getTime()));
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      holidayKeys.add(dayKey(date));
    }
  }
  const workFromHomeCredits = buildApprovedWorkFromHomeCredits(
    leaveRows.map((request) => ({
      employeeId: request.employeeId ?? null,
      requestType: request.requestType ?? 'LEAVE',
      status: request.status,
      startDate: request.startDate,
      endDate: request.endDate,
    })),
    (requestedEmployeeId, date) => {
      if (
        requestedEmployeeId !== employeeId ||
        (employee.hireDate && dayKey(date) < dayKey(employee.hireDate))
      ) {
        return false;
      }
      const dateKey = dayKey(date);
      const attendance = attendanceByDate.get(dateKey);
      const shift =
        resolveShiftForDate(
          employee.shiftAssignments,
          employee.shift,
          attendance?.shift,
          date,
        ) ?? DEFAULT_PAYROLL_SHIFT;
      return (
        isScheduledWorkday(date, shift) &&
        !holidayKeys.has(dateKey) &&
        !ordinaryLeaveRows.some(
          (request) =>
            dayKey(request.startDate) <= dateKey &&
            dayKey(request.endDate) >= dateKey,
        )
      );
    },
  );

  const cutoverDate = getFlexibleTaskTimeCutoverDate();
  let presentDays = 0;
  let absentDays = 0;
  let paidLeaves = 0;
  let unpaidLeaves = 0;
  let totalWorkingDays = 0;
  let totalWorkedHours = 0;
  let totalExpectedHours = 0;
  let lateCount = 0;
  let overtimeHours = 0;

  for (
    const date = new Date(startDate);
    date < nextMonthStart;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const dateKey = dayKey(date);
    if (
      holidayKeys.has(dateKey) ||
      (employee.hireDate && dateKey < dayKey(employee.hireDate))
    ) {
      continue;
    }
    const attendance = attendanceByDate.get(dateKey);
    const shift =
      resolveShiftForDate(
        employee.shiftAssignments,
        employee.shift,
        attendance?.shift,
        date,
      ) ?? DEFAULT_PAYROLL_SHIFT;
    if (!isScheduledWorkday(date, shift)) continue;
    const leave = ordinaryLeaveRows.find(
      (request) =>
        dayKey(request.startDate) <= dateKey &&
        dayKey(request.endDate) >= dateKey,
    );
    const leaveFraction = leave ? (leave.duration === 'HALF_DAY' ? 0.5 : 1) : 0;
    if (leave) {
      if (leave.isPaid ?? true) paidLeaves += leaveFraction || 1;
      else unpaidLeaves += leaveFraction || 1;
      if (leaveFraction === 1) continue;
    }
    if (
      attendance?.status === 'LEAVE' ||
      attendance?.status === 'HOLIDAY' ||
      attendance?.status === 'WEEKLY_OFF'
    ) {
      continue;
    }

    const eligibleFraction = 1 - leaveFraction;
    totalWorkingDays += eligibleFraction;
    const requiredHours =
      shift.type === 'FLEXIBLE'
        ? 8
        : (attendance?.requiredHours ?? shift.requiredHours ?? 8);
    totalExpectedHours += requiredHours * eligibleFraction;
    const dayStart = localMidnightAtDateInTimezone(dateKey, timezone);
    const dayEnd = localMidnightAfterDateInTimezone(dateKey, timezone);
    if (!dayStart || !dayEnd) {
      throw new Error(
        'Unable to calculate payroll attendance date in organization timezone',
      );
    }

    if (shift.type === 'FLEXIBLE') {
      const dayTimesheetHours = manualTimesheets
        .filter((timesheet) => dayKey(timesheet.date) === dateKey)
        .reduce((total, timesheet) => total + Math.max(0, timesheet.hours), 0);
      const legacyAttendanceHours =
        attendance?.workingHours != null
          ? Math.max(0, attendance.workingHours)
          : attendance?.checkIn
            ? Math.max(
                0,
                (Math.min(
                  dayEnd.getTime(),
                  attendance.checkOut?.getTime() ?? Date.now(),
                ) -
                  Math.max(dayStart.getTime(), attendance.checkIn.getTime()) -
                  (attendance.breaks ?? []).reduce((total, interval) => {
                    const breakStart = Math.max(
                      dayStart.getTime(),
                      interval.startedAt.getTime(),
                    );
                    const breakEnd = Math.min(
                      dayEnd.getTime(),
                      interval.endedAt?.getTime() ?? Date.now(),
                    );
                    return total + Math.max(0, breakEnd - breakStart);
                  }, 0)) /
                  3_600_000,
              )
            : 0;
      const creditedHours =
        dateKey < cutoverDate
          ? legacyAttendanceHours + dayTimesheetHours
          : sumIntervalSeconds(taskIntervals, dayStart, dayEnd) / 3600 +
            dayTimesheetHours;
      totalWorkedHours += creditedHours;
      const workFromHomeCredit = workFromHomeCredits.get(
        `${employeeId}:${dateKey}`,
      );
      presentDays +=
        workFromHomeCredit !== undefined
          ? workFromHomeCredit
          : Math.min(creditedHours / 8, eligibleFraction);
      if (
        workFromHomeCredit === undefined &&
        attendance?.status === 'ABSENT'
      ) {
        absentDays += eligibleFraction;
      }
      continue;
    }

    const workFromHomeCredit = workFromHomeCredits.get(
      `${employeeId}:${dateKey}`,
    );
    const status = attendance?.status;
    if (workFromHomeCredit !== undefined) {
      presentDays += workFromHomeCredit;
    } else if (status === 'PRESENT') presentDays += eligibleFraction;
    else if (status === 'HALF_DAY') {
      presentDays += Math.min(0.5, eligibleFraction);
    } else if (status === 'ABSENT') {
      absentDays += eligibleFraction;
    }
    if (attendance) {
      const workedHours =
        attendance.workingHours != null
          ? Math.max(0, attendance.workingHours)
          : attendance.checkIn
            ? Math.max(
                0,
                (Math.min(
                  dayEnd.getTime(),
                  attendance.checkOut?.getTime() ?? Date.now(),
                ) -
                  Math.max(dayStart.getTime(), attendance.checkIn.getTime()) -
                  (attendance.breaks ?? []).reduce((total, interval) => {
                    const breakStart = Math.max(
                      dayStart.getTime(),
                      interval.startedAt.getTime(),
                    );
                    const breakEnd = Math.min(
                      dayEnd.getTime(),
                      interval.endedAt?.getTime() ?? Date.now(),
                    );
                    return total + Math.max(0, breakEnd - breakStart);
                  }, 0)) /
                  3_600_000,
              )
            : 0;
      totalWorkedHours += workedHours;
      lateCount += (attendance.lateMinutes ?? 0) > 0 ? 1 : 0;
      overtimeHours += Math.max(0, attendance.overtimeHours ?? 0);
    }
  }

  absentDays += unpaidLeaves;
  totalExpectedHours = Number(totalExpectedHours.toFixed(2));
  totalWorkedHours = Number(totalWorkedHours.toFixed(2));
  return {
    presentDays: Number(presentDays.toFixed(2)),
    absentDays: Number(absentDays.toFixed(2)),
    paidLeaves: Number(paidLeaves.toFixed(2)),
    unpaidLeaves: Number(unpaidLeaves.toFixed(2)),
    totalWorkingDays: Number(totalWorkingDays.toFixed(2)),
    lateCount,
    overtimeHours: Number(overtimeHours.toFixed(2)),
    totalWorkedHours,
    totalExpectedHours,
    totalShortfallHours: Number(
      Math.max(0, totalExpectedHours - totalWorkedHours).toFixed(2),
    ),
  };
}
