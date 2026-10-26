export function calendarDate(value: string) {
  return value.slice(0, 10);
}

export function dateTimeInZone(value: string | null, timeZone: string): string {
  if (!value) return "";
  const instant = new Date(value);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${String(instant.getUTCMilliseconds()).padStart(3, "0")}`;
}

/** Reject nonexistent and ambiguous wall times instead of silently changing an instant. */
export function instantFromZone(
  value: string,
  timeZone: string,
): string | undefined {
  if (!value) return undefined;
  let normalized =
    value.length === 16
      ? `${value}:00.000`
      : value.length === 19
        ? `${value}.000`
        : value;
  const wall = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(wall)) throw new Error("Enter a valid date and time.");
  normalized = new Date(wall).toISOString().slice(0, -1);
  if (normalized.slice(0, 10) !== value.slice(0, 10)) throw new Error("Enter a valid calendar date.");
  const matches = new Set<string>();
  for (let hours = -36; hours <= 36; hours++) {
    const probe = wall + hours * 3_600_000;
    const offset =
      Date.parse(
        `${dateTimeInZone(new Date(probe).toISOString(), timeZone)}Z`,
      ) - probe;
    const candidate = new Date(wall - offset).toISOString();
    if (dateTimeInZone(candidate, timeZone) === normalized)
      matches.add(candidate);
  }
  if (matches.size !== 1)
    throw new Error(
      "This local time is ambiguous or does not exist because of a clock change. Choose an unambiguous time.",
    );
  return [...matches][0];
}

export function changedInstant(
  value: string,
  original: string | null,
  timeZone: string,
) {
  if (value === dateTimeInZone(original, timeZone)) return undefined;
  if (!value && original)
    throw new Error(
      "Use the explicit reopen action to clear checkout; recorded timestamps cannot be cleared here.",
    );
  return instantFromZone(value, timeZone);
}

export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function shiftNumber(
  value: string,
  fallback: number,
  min: number,
  max: number,
) {
  const number = value.trim() === "" ? fallback : Number(value);
  if (!Number.isFinite(number) || number < min || number > max)
    throw new Error(`Enter a number between ${min} and ${max}.`);
  return number;
}

export function splitTwelveHourDateTime(value: string) {
  const [date = '', time = '00:00'] = value.split('T');
  const [hour24, minute = '00'] = time.split(':');
  const hour = Number(hour24);
  return { date, hour: String(hour % 12 || 12).padStart(2, '0'), minute,
    period: hour >= 12 ? 'PM' : 'AM' };
}

export function joinTwelveHourDateTime(parts: {
  date: string; hour: string; minute: string; period: string;
}, original = '', dateOnly = false) {
  if (!parts.date) return '';
  const hour = Number(parts.hour) % 12 + (parts.period === 'PM' ? 12 : 0);
  const seconds = dateOnly ? (original.split('T')[1]?.split(':').slice(2).join(':') || '00.000') : '00.000';
  return `${parts.date}T${String(hour).padStart(2, '0')}:${parts.minute}:${seconds}`;
}
