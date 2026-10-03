import { calculateNetWorkingHours } from './attendance-work-time.utils';

describe('calculateNetWorkingHours', () => {
  it('subtracts completed break intervals from elapsed time', () => {
    const hours = calculateNetWorkingHours(
      new Date('2026-10-01T09:00:00.000Z'),
      new Date('2026-10-01T18:00:00.000Z'),
      [
        {
          startedAt: new Date('2026-10-01T13:00:00.000Z'),
          endedAt: new Date('2026-10-01T14:00:00.000Z'),
        },
      ],
    );

    expect(hours).toBe(8);
  });

  it('counts an open break through the requested end time', () => {
    const hours = calculateNetWorkingHours(
      new Date('2026-10-01T09:00:00.000Z'),
      new Date('2026-10-01T14:00:00.000Z'),
      [
        {
          startedAt: new Date('2026-10-01T13:00:00.000Z'),
          endedAt: null,
        },
      ],
    );

    expect(hours).toBe(4);
  });

  it('clips break intervals to the attendance interval', () => {
    const hours = calculateNetWorkingHours(
      new Date('2026-10-01T09:00:00.000Z'),
      new Date('2026-10-01T17:00:00.000Z'),
      [
        {
          startedAt: new Date('2026-10-01T08:00:00.000Z'),
          endedAt: new Date('2026-10-01T10:00:00.000Z'),
        },
      ],
    );

    expect(hours).toBe(7);
  });
});
