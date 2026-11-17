import { PrismaClient } from '@prisma/client';
import {
  attendanceDateFromKey,
  dateKeyInTimezone,
  localMidnightAfterDateInTimezone,
  localMidnightAtDateInTimezone,
} from '../src/attendance/attendance-time.utils';

const prisma = new PrismaClient();

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function validDateKey(value: string | undefined, fallback: string) {
  const candidate = value ?? fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    throw new Error(`--from and --to must use YYYY-MM-DD format`);
  }
  return candidate;
}

async function expectedTaskHours(
  employeeId: number,
  organizationId: number,
  timezone: string,
  dateKey: string,
) {
  const date = attendanceDateFromKey(dateKey);
  const nextDate = new Date(date.getTime() + 86_400_000);
  const dayStart = localMidnightAtDateInTimezone(dateKey, timezone);
  const dayEnd = localMidnightAfterDateInTimezone(dateKey, timezone);
  if (!dayStart || !dayEnd) throw new Error(`Invalid timezone day ${dateKey}`);
  const [manual, intervals, legacyTimers] = await Promise.all([
    prisma.timesheet.aggregate({
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
    prisma.taskTimerInterval.findMany({
      where: {
        timerSession: { user: { employeeId } },
        startedAt: { lt: dayEnd },
        endedAt: { gt: dayStart },
      },
      select: { startedAt: true, endedAt: true },
    }),
    prisma.timesheet.findMany({
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
        timerSession: { select: { intervals: { select: { id: true } } } },
      },
    }),
  ]);
  const intervalHours = intervals.reduce((total, interval) => {
    const start = Math.max(interval.startedAt.getTime(), dayStart.getTime());
    const end = Math.min(interval.endedAt.getTime(), dayEnd.getTime());
    return total + Math.max(0, end - start) / 3_600_000;
  }, 0);
  const legacyHours = legacyTimers
    .filter(
      (item) =>
        dateKeyInTimezone(item.date, timezone) === dateKey &&
        (!item.timerSession || item.timerSession.intervals.length === 0),
    )
    .reduce((total, item) => total + item.hours, 0);
  return (manual._sum.hours ?? 0) + intervalHours + legacyHours;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const fromKey = validDateKey(argument('from'), '2026-10-17');
  const toKey = validDateKey(argument('to'), today);
  if (fromKey > toKey) throw new Error('--from must not be after --to');
  const organizationIdValue = argument('organization');
  const organizationId = organizationIdValue
    ? Number(organizationIdValue)
    : undefined;
  if (organizationIdValue && !Number.isInteger(organizationId)) {
    throw new Error('--organization must be an integer');
  }
  const apply = process.argv.includes('--apply');
  const rows = await prisma.attendance.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      date: {
        gte: attendanceDateFromKey(fromKey),
        lte: attendanceDateFromKey(toKey),
      },
      deletedAt: null,
    },
    select: {
      id: true,
      employeeId: true,
      organizationId: true,
      date: true,
      taskHours: true,
      organization: { select: { timezone: true } },
    },
    orderBy: [{ organizationId: 'asc' }, { employeeId: 'asc' }, { date: 'asc' }],
  });
  const changes: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const dateKey = row.date.toISOString().slice(0, 10);
    const expected = await expectedTaskHours(
      row.employeeId,
      row.organizationId,
      row.organization.timezone ?? 'UTC',
      dateKey,
    );
    if (Math.abs((row.taskHours ?? 0) - expected) < 1e-9) continue;
    changes.push({
      attendanceId: row.id,
      employeeId: row.employeeId,
      organizationId: row.organizationId,
      date: dateKey,
      oldTaskHours: row.taskHours ?? 0,
      newTaskHours: expected,
    });
    if (apply) {
      await prisma.$transaction([
        prisma.attendance.update({ where: { id: row.id }, data: { taskHours: expected } }),
        prisma.auditLog.create({
          data: {
            organizationId: row.organizationId,
            userRole: 'SYSTEM',
            module: 'ATTENDANCE',
            entityType: 'Attendance',
            entityId: row.id,
            action: 'RECONCILE_TASK_HOURS',
            fieldName: 'taskHours',
            oldValue: { taskHours: row.taskHours ?? 0 },
            newValue: { taskHours: expected },
            description: `Reconciled task hours for ${dateKey}`,
          },
        }),
      ]);
    }
  }
  process.stdout.write(
    `${JSON.stringify({ mode: apply ? 'apply' : 'dry-run', scanned: rows.length, changed: changes.length, changes }, null, 2)}\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
