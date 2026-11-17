import {
  calculateAttendanceCredit,
  resolveCreditedWorkHours,
} from './attendance-credit.utils';

describe('resolveCreditedWorkHours', () => {
  it('does not add task attribution to fixed attendance time', () => {
    expect(
      resolveCreditedWorkHours({
        attendanceHours: 8,
        taskTrackedHours: 6,
      }),
    ).toBe(8);
  });

  it('separates flexible attendance, attributed work and credited work', () => {
    expect(
      calculateAttendanceCredit({
        attendanceHours: 8,
        taskTrackedHours: 6,
        shiftType: 'FLEXIBLE',
        dateKey: '2026-10-20',
        flexibleTaskCutoverDate: '2026-10-17',
      }),
    ).toEqual({
      attendanceHours: 8,
      taskTrackedHours: 6,
      creditedWorkHours: 6,
      untrackedAttendanceHours: 2,
      calculationMode: 'TASK_TRACKED',
    });
  });

  it('keeps attendance as flexible credit before the cutover', () => {
    expect(
      calculateAttendanceCredit({
        attendanceHours: 8,
        taskTrackedHours: 0,
        shiftType: 'FLEXIBLE',
        dateKey: '2026-10-16',
        flexibleTaskCutoverDate: '2026-10-17',
      }).creditedWorkHours,
    ).toBe(8);
  });

  it('uses policy-adjusted flexible credit when supplied', () => {
    expect(
      resolveCreditedWorkHours({
        attendanceHours: 8,
        taskTrackedHours: 6,
        creditedWorkSeconds: 21_600,
      }),
    ).toBe(6);
  });
});
