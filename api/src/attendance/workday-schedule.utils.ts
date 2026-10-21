export type WorkdayShift = {
  type?: string;
  requiredHours?: number;
  weeklyHolidayDay?: number;
  workingDays?: number[];
};

export type WorkdayShiftAssignment<TShift extends WorkdayShift> = {
  effectiveFrom: Date;
  effectiveTo: Date | null;
  shift: TShift;
};

export function resolveShiftForDate<TShift extends WorkdayShift>(
  assignments: WorkdayShiftAssignment<TShift>[] | undefined,
  currentShift: TShift | null,
  attendanceShift: TShift | null | undefined,
  date: Date,
): TShift | null {
  const dateStart = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const assignment = assignments
    ?.filter(
      (item) =>
        item.effectiveFrom.getTime() <= dateStart &&
        (item.effectiveTo === null || item.effectiveTo.getTime() > dateStart),
    )
    .sort(
      (left, right) =>
        right.effectiveFrom.getTime() - left.effectiveFrom.getTime(),
    )[0];
  if (assignment) return assignment.shift;
  if (assignments?.length) return attendanceShift ?? null;
  return attendanceShift ?? currentShift;
}

export function isScheduledWorkday(date: Date, shift: WorkdayShift): boolean {
  const workingDays =
    shift.workingDays ??
    [0, 1, 2, 3, 4, 5, 6].filter(
      (weekday) => weekday !== (shift.weeklyHolidayDay ?? 0),
    );
  return workingDays.includes(date.getUTCDay());
}

export function dayKey(date: Date): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}
