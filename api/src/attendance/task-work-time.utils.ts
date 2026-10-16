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
  return Math.floor(
    intervals.reduce((total, interval) => {
      const start = Math.max(startLimit, interval.startedAt.getTime());
      const end = Math.min(endLimit, interval.endedAt.getTime());
      return total + Math.max(0, end - start);
    }, 0) / 1000,
  );
}
