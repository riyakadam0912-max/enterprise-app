import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

@Injectable()
export class AttendanceTaskHoursService {
  async recomputeTimesheetHours(
    employeeId: number,
    organizationId: number,
    timesheetDate: Date,
    transaction: Prisma.TransactionClient,
  ) {
    const date = new Date(
      Date.UTC(
        timesheetDate.getUTCFullYear(),
        timesheetDate.getUTCMonth(),
        timesheetDate.getUTCDate(),
      ),
    );
    const nextDate = new Date(date.getTime() + 86_400_000);
    const dayNumber = Math.floor(date.getTime() / 86_400_000);

    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(${employeeId}, ${dayNumber})
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

    const taskHours = await transaction.timesheet.aggregate({
      where: {
        employeeId,
        organizationId,
        date: { gte: date, lt: nextDate },
        status: { not: 'REJECTED' },
        deletedAt: null,
      },
      _sum: { hours: true },
    });
    const shiftAssignment = employee.shiftAssignments[0];

    await transaction.attendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: {
        employeeId,
        organizationId,
        date,
        shiftId: shiftAssignment?.shiftId ?? employee.shiftId,
        requiredHours:
          shiftAssignment?.shift.requiredHours ?? employee.shift?.requiredHours,
        status: 'NOT_STARTED',
        taskHours: taskHours._sum.hours ?? 0,
      },
      update: { taskHours: taskHours._sum.hours ?? 0 },
    });
  }
}
