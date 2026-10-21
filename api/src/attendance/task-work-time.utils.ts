export type TaskWorkInterval = {
  startedAt: Date;
  endedAt: Date;
};

export const DEFAULT_FLEXIBLE_TASK_TIME_CUTOVER_DATE = '2026-10-17';

export function getFlexibleTaskTimeCutoverDate() {
  const value =
    process.env.ATTENDANCE_FLEXIBLE_TASK_CUTOVER_DATE ??
    DEFAULT_FLEXIBLE_TASK_TIME_CUTOVER_DATE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(
      'ATTENDANCE_FLEXIBLE_TASK_CUTOVER_DATE must use YYYY-MM-DD format',
    );
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(
      'ATTENDANCE_FLEXIBLE_TASK_CUTOVER_DATE must be a valid calendar date',
    );
  }
  return value;
}

export function sumIntervalSeconds(
  intervals: TaskWorkInterval[],
  rangeStart: Date,
  rangeEnd: Date,
) {
  const startLimit = rangeStart.getTime();
  const endLimit = rangeEnd.getTime();
  const clipped = intervals
    .map((interval) => ({
      start: Math.max(startLimit, interval.startedAt.getTime()),
      end: Math.min(endLimit, interval.endedAt.getTime()),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start - right.start);
  let totalMs = 0;
  let currentStart: number | null = null;
  let currentEnd = 0;

  for (const interval of clipped) {
    if (currentStart === null) {
      currentStart = interval.start;
      currentEnd = interval.end;
    } else if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
    } else {
      totalMs += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
  }

  if (currentStart !== null) totalMs += currentEnd - currentStart;
  return Math.floor(totalMs / 1000);
}
