export function countLeaveDaysInPeriod(
  startDate: Date,
  endDate: Date,
  duration: string | null | undefined,
  periodStart: Date,
  periodEnd: Date,
) {
  const start = new Date(
    Math.max(startDate.getTime(), periodStart.getTime()),
  );
  const end = new Date(Math.min(endDate.getTime(), periodEnd.getTime()));
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end < start) return 0;

  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return duration === 'HALF_DAY' ? 0.5 : days;
}