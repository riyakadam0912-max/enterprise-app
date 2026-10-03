export type AttendanceBreakInterval = {
  startedAt: Date;
  endedAt: Date | null;
};

export function calculateNetWorkingHours(
  checkIn: Date,
  checkOut: Date,
  breaks: AttendanceBreakInterval[],
) {
  const elapsedMs = Math.max(0, checkOut.getTime() - checkIn.getTime());
  const breakMs = breaks.reduce((total, interval) => {
    const start = Math.max(checkIn.getTime(), interval.startedAt.getTime());
    const end = Math.min(checkOut.getTime(), interval.endedAt?.getTime() ?? checkOut.getTime());
    return total + Math.max(0, end - start);
  }, 0);
  return Number((Math.max(0, elapsedMs - breakMs) / 36e5).toFixed(2));
}