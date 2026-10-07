type ShiftTimeFields = {
  type: string;
  startTime: string | null;
  gracePeriodMinutes: number | null;
};

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
}

function safeTimezone(timezone?: string | null) {
  const value = timezone || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return 'UTC';
  }
}

export function dateKeyInTimezone(date: Date, timezone?: string | null) {
  const parts = getZonedParts(date, safeTimezone(timezone));
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(
    parts.day,
  ).padStart(2, '0')}`;
}

export function attendanceDateFromKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error(`Invalid attendance date: ${dateKey}`);
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

function localShiftStart(dateKey: string, time: string, timezone: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const targetParts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? 0),
  };
  if (
    targetParts.hour > 23 ||
    targetParts.minute > 59 ||
    targetParts.second > 59
  ) {
    return null;
  }

  const targetAsUtc = Date.UTC(
    targetParts.year,
    targetParts.month - 1,
    targetParts.day,
    targetParts.hour,
    targetParts.minute,
    targetParts.second,
  );
  let candidate = targetAsUtc;
  for (let attempt = 0; attempt < 4; attempt++) {
    const localParts = getZonedParts(new Date(candidate), timezone);
    const representedAsUtc = Date.UTC(
      localParts.year,
      localParts.month - 1,
      localParts.day,
      localParts.hour,
      localParts.minute,
      localParts.second,
    );
    const difference = targetAsUtc - representedAsUtc;
    if (difference === 0) return new Date(candidate);
    candidate += difference;
  }

  return null;
}

function nextDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

export function localMidnightAfterDateInTimezone(
  dateKey: string,
  timezone?: string | null,
) {
  return localShiftStart(nextDateKey(dateKey), '00:00', safeTimezone(timezone));
}

export function shiftEndInTimezone(
  dateKey: string,
  shift: { startTime: string | null; endTime: string | null },
  timezone?: string | null,
) {
  if (!shift.startTime || !shift.endTime) return null;
  const zone = safeTimezone(timezone);
  const start = localShiftStart(dateKey, shift.startTime, zone);
  if (!start) return null;

  let end = localShiftStart(dateKey, shift.endTime, zone);
  if (!end) return null;
  if (end.getTime() <= start.getTime()) {
    end = localShiftStart(nextDateKey(dateKey), shift.endTime, zone);
  }
  return end;
}

export function calculateLateMinutesInTimezone(
  checkIn: Date,
  dateKey: string,
  shift: ShiftTimeFields | null,
  timezone?: string | null,
) {
  if (!shift?.startTime || shift.type === 'FLEXIBLE') return 0;

  const zone = safeTimezone(timezone);
  const shiftStart = localShiftStart(dateKey, shift.startTime, zone);
  if (!shiftStart) return 0;

  const effectiveStart =
    shiftStart.getTime() + (shift.gracePeriodMinutes ?? 0) * 60_000;
  return checkIn.getTime() <= effectiveStart
    ? 0
    : Math.floor((checkIn.getTime() - effectiveStart) / 60_000);
}

export function attendanceStatusForWorkedHours(
  workingHours: number,
  requiredPresentHours: number,
) {
  const halfDayThreshold = Math.max(1, requiredPresentHours / 2);
  if (workingHours >= requiredPresentHours) return 'PRESENT' as const;
  if (workingHours >= halfDayThreshold) return 'HALF_DAY' as const;
  return 'ABSENT' as const;
}