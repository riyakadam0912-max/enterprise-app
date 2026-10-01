import { describe, expect, it } from '@jest/globals';
import {
  attendanceDateFromKey,
  attendanceStatusForWorkedHours,
  calculateLateMinutesInTimezone,
  dateKeyInTimezone,
} from './attendance-time.utils';

describe('attendance time utilities', () => {
  it('uses the organization timezone and applies the grace period at the boundary', () => {
    const shift = {
      type: 'FIXED',
      startTime: '09:00',
      gracePeriodMinutes: 15,
    };

    expect(
      calculateLateMinutesInTimezone(
        new Date('2026-03-13T03:45:00.000Z'),
        '2026-03-13',
        shift,
        'Asia/Kolkata',
      ),
    ).toBe(0);
    expect(
      calculateLateMinutesInTimezone(
        new Date('2026-03-13T03:46:00.000Z'),
        '2026-03-13',
        shift,
        'Asia/Kolkata',
      ),
    ).toBe(1);
  });

  it('derives organization-local dates across UTC date boundaries', () => {
    const instant = new Date('2026-03-12T19:00:00.000Z');
    const dateKey = dateKeyInTimezone(instant, 'Asia/Kolkata');

    expect(dateKey).toBe('2026-03-13');
    expect(attendanceDateFromKey(dateKey)).toEqual(
      new Date('2026-03-13T00:00:00.000Z'),
    );
  });

  it('does not count flexible shifts as late and derives half-day from worked hours', () => {
    expect(
      calculateLateMinutesInTimezone(
        new Date('2026-03-13T12:00:00.000Z'),
        '2026-03-13',
        { type: 'FLEXIBLE', startTime: '09:00', gracePeriodMinutes: 0 },
        'UTC',
      ),
    ).toBe(0);

    expect(attendanceStatusForWorkedHours(5, 5)).toBe('PRESENT');
    expect(attendanceStatusForWorkedHours(2.5, 5)).toBe('HALF_DAY');
    expect(attendanceStatusForWorkedHours(2.49, 5)).toBe('ABSENT');
  });
});