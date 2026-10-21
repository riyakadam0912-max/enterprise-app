import { buildApprovedWorkFromHomeCredits } from './work-from-home.utils';

describe('buildApprovedWorkFromHomeCredits', () => {
  it('grants full credit to the first two scheduled dates per month, then half', () => {
    const credits = buildApprovedWorkFromHomeCredits(
      [
        {
          employeeId: 9,
          requestType: 'WORK_FROM_HOME',
          status: 'APPROVED',
          startDate: new Date('2026-10-01T00:00:00.000Z'),
          endDate: new Date('2026-10-05T00:00:00.000Z'),
        },
      ],
      (_employeeId, date) => date.getUTCDay() !== 0 && date.getUTCDay() !== 6,
    );

    expect([...credits]).toEqual([
      ['9:2026-10-01', 1],
      ['9:2026-10-02', 1],
      ['9:2026-10-05', 0.5],
    ]);
  });

  it('resets the allowance for each calendar month', () => {
    const credits = buildApprovedWorkFromHomeCredits(
      [
        {
          employeeId: 9,
          requestType: 'WORK_FROM_HOME',
          status: 'APPROVED',
          startDate: new Date('2026-10-30T00:00:00.000Z'),
          endDate: new Date('2026-11-03T00:00:00.000Z'),
        },
      ],
      (_employeeId, date) => date.getUTCDay() !== 0 && date.getUTCDay() !== 6,
    );

    expect([...credits]).toEqual([
      ['9:2026-10-30', 1],
      ['9:2026-11-02', 1],
      ['9:2026-11-03', 1],
    ]);
  });

  it('ignores pending and non-WFH requests', () => {
    const credits = buildApprovedWorkFromHomeCredits(
      [
        {
          employeeId: 9,
          requestType: 'LEAVE',
          status: 'APPROVED',
          startDate: new Date('2026-10-01T00:00:00.000Z'),
          endDate: new Date('2026-10-01T00:00:00.000Z'),
        },
        {
          employeeId: 9,
          requestType: 'WORK_FROM_HOME',
          status: 'PENDING_HR',
          startDate: new Date('2026-10-02T00:00:00.000Z'),
          endDate: new Date('2026-10-02T00:00:00.000Z'),
        },
      ],
      () => true,
    );

    expect(credits.size).toBe(0);
  });
});
