import { sumIntervalSeconds } from './task-work-time.utils';

describe('sumIntervalSeconds', () => {
  const dayStart = new Date('2026-10-16T00:00:00.000Z');
  const dayEnd = new Date('2026-10-17T00:00:00.000Z');

  it('counts only the part of an interval inside the requested day', () => {
    expect(
      sumIntervalSeconds(
        [
          {
            startedAt: new Date('2026-10-15T23:30:00.000Z'),
            endedAt: new Date('2026-10-16T01:00:00.000Z'),
          },
          {
            startedAt: new Date('2026-10-16T23:00:00.000Z'),
            endedAt: new Date('2026-10-17T00:30:00.000Z'),
          },
        ],
        dayStart,
        dayEnd,
      ),
    ).toBe(7200);
  });

  it('does not count intervals outside the day and floors partial seconds', () => {
    expect(
      sumIntervalSeconds(
        [
          {
            startedAt: new Date('2026-10-15T23:00:00.000Z'),
            endedAt: new Date('2026-10-15T23:59:59.000Z'),
          },
          {
            startedAt: new Date('2026-10-16T01:00:00.000Z'),
            endedAt: new Date('2026-10-16T01:00:02.900Z'),
          },
        ],
        dayStart,
        dayEnd,
      ),
    ).toBe(2);
  });

  it('does not double-count overlapping task intervals', () => {
    expect(
      sumIntervalSeconds(
        [
          {
            startedAt: new Date('2026-10-16T09:00:00.000Z'),
            endedAt: new Date('2026-10-16T11:00:00.000Z'),
          },
          {
            startedAt: new Date('2026-10-16T10:00:00.000Z'),
            endedAt: new Date('2026-10-16T12:00:00.000Z'),
          },
        ],
        dayStart,
        dayEnd,
      ),
    ).toBe(10_800);
  });
});
