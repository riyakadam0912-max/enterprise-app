export type TaskWorkInterval = {
  startedAt: Date;
  endedAt: Date;
};

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
