import { countLeaveDaysInPeriod } from './leave-day-count';

describe('countLeaveDaysInPeriod', () => {
  const periodStart = new Date('2026-08-01T00:00:00.000Z');
  const periodEnd = new Date('2026-08-31T23:59:59.999Z');

  it('counts each date in a multi-day half-day request as half a day', () => {
    expect(
      countLeaveDaysInPeriod(
        new Date('2026-08-10T00:00:00.000Z'),
        new Date('2026-08-12T00:00:00.000Z'),
        'HALF_DAY',
        periodStart,
        periodEnd,
      ),
    ).toBe(1.5);
  });

  it('counts only the portion of a half-day range overlapping the period', () => {
    expect(
      countLeaveDaysInPeriod(
        new Date('2026-07-30T00:00:00.000Z'),
        new Date('2026-08-02T00:00:00.000Z'),
        'HALF_DAY',
        periodStart,
        periodEnd,
      ),
    ).toBe(1);
  });

  it('preserves full-day counts', () => {
    expect(
      countLeaveDaysInPeriod(
        new Date('2026-08-10T00:00:00.000Z'),
        new Date('2026-08-12T00:00:00.000Z'),
        'FULL_DAY',
        periodStart,
        periodEnd,
      ),
    ).toBe(3);
  });
});
