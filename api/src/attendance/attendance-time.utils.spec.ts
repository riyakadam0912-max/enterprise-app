import { describe, expect, it } from '@jest/globals';
import {
  attendanceDateFromKey,
  attendanceStatusForWorkedHours,
  calculateLateMinutesInTimezone,
  dateKeyInTimezone,
  localMidnightAfterDateInTimezone,
  shiftEndInTimezone,
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

  it('counts the production 1:32 PM check-in as late for an 11:00 AM Kolkata shift', () => {
    expect(
      calculateLateMinutesInTimezone(
        new Date('2026-10-01T08:02:08.019Z'),
        '2026-10-01',
        { type: 'FIXED', startTime: '11:00', gracePeriodMinutes: 0 },
        'Asia/Kolkata',
      ),
    ).toBe(152);
  });

  it('derives organization-local dates across UTC date boundaries', () => {
    const instant = new Date('2026-03-12T19:00:00.000Z');
    const dateKey = dateKeyInTimezone(instant, 'Asia/Kolkata');

    expect(dateKey).toBe('2026-03-13');
    expect(attendanceDateFromKey(dateKey)).toEqual(
      new Date('2026-03-13T00:00:00.000Z'),
    );
  });

  it('resolves a night shift end on the following local date', () => {
    expect(
      shiftEndInTimezone(
        '2026-03-13',
        { startTime: '21:00', endTime: '05:00' },
        'Asia/Kolkata',
      ),
    ).toEqual(new Date('2026-03-13T23:30:00.000Z'));
  });

  it('resolves the next local midnight as a UTC instant', () => {
    expect(
      localMidnightAfterDateInTimezone('2026-03-13', 'Asia/Kolkata'),
    ).toEqual(new Date('2026-03-13T18:30:00.000Z'));
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
