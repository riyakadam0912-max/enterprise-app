import {
  isScheduledWorkday,
  resolveShiftForDate,
} from './workday-schedule.utils';

describe('workday schedule utilities', () => {
  const fixedShift = { id: 1, type: 'FIXED', workingDays: [1, 2, 3, 4, 5] };
  const flexibleShift = {
    id: 2,
    type: 'FLEXIBLE',
    workingDays: [0, 1, 2, 3, 4, 5, 6],
  };

  it('resolves the assignment effective on the requested date', () => {
    const shift = resolveShiftForDate(
      [
        {
          effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
          effectiveTo: new Date('2026-10-15T00:00:00.000Z'),
          shift: fixedShift,
        },
        {
          effectiveFrom: new Date('2026-10-15T00:00:00.000Z'),
          effectiveTo: null,
          shift: flexibleShift,
        },
      ],
      fixedShift,
      null,
      new Date('2026-10-15T00:00:00.000Z'),
    );

    expect(shift).toBe(flexibleShift);
  });

  it('does not apply the current shift to gaps in assignment history', () => {
    const shift = resolveShiftForDate(
      [
        {
          effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
          effectiveTo: new Date('2026-10-10T00:00:00.000Z'),
          shift: fixedShift,
        },
      ],
      flexibleShift,
      null,
      new Date('2026-10-15T00:00:00.000Z'),
    );

    expect(shift).toBeNull();
  });

  it('uses an attendance shift snapshot when assignment history has a gap', () => {
    const shift = resolveShiftForDate(
      [
        {
          effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
          effectiveTo: new Date('2026-10-10T00:00:00.000Z'),
          shift: fixedShift,
        },
      ],
      flexibleShift,
      fixedShift,
      new Date('2026-10-15T00:00:00.000Z'),
    );

    expect(shift).toBe(fixedShift);
  });

  it('uses the effective working-day list for a schedule date', () => {
    expect(
      isScheduledWorkday(new Date('2026-10-17T00:00:00.000Z'), fixedShift),
    ).toBe(false);
    expect(
      isScheduledWorkday(new Date('2026-10-19T00:00:00.000Z'), fixedShift),
    ).toBe(true);
  });
});
