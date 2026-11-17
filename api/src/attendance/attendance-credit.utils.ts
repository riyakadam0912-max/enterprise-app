export type AttendanceCreditInput = {
  attendanceHours: number | null | undefined;
  taskTrackedHours: number | null | undefined;
  creditedWorkSeconds?: number;
};

export type AttendanceCalculationMode =
  | 'FIXED_ATTENDANCE'
  | 'LEGACY_FLEXIBLE'
  | 'TASK_TRACKED';

export type AttendanceCreditPolicyInput = AttendanceCreditInput & {
  shiftType: string | null | undefined;
  dateKey: string;
  flexibleTaskCutoverDate: string;
};

export function calculateAttendanceCredit({
  attendanceHours,
  taskTrackedHours,
  creditedWorkSeconds,
  shiftType,
  dateKey,
  flexibleTaskCutoverDate,
}: AttendanceCreditPolicyInput) {
  const safeAttendanceHours = Math.max(0, attendanceHours ?? 0);
  const safeTaskTrackedHours = Math.max(0, taskTrackedHours ?? 0);
  const calculationMode: AttendanceCalculationMode =
    shiftType !== 'FLEXIBLE'
      ? 'FIXED_ATTENDANCE'
      : dateKey < flexibleTaskCutoverDate
        ? 'LEGACY_FLEXIBLE'
        : 'TASK_TRACKED';
  const creditedWorkHours =
    creditedWorkSeconds !== undefined
      ? Math.max(0, creditedWorkSeconds / 3600)
      : calculationMode === 'TASK_TRACKED'
        ? safeTaskTrackedHours
        : safeAttendanceHours;

  return {
    attendanceHours: safeAttendanceHours,
    taskTrackedHours: safeTaskTrackedHours,
    creditedWorkHours,
    untrackedAttendanceHours: Math.max(
      0,
      safeAttendanceHours - safeTaskTrackedHours,
    ),
    calculationMode,
  };
}

/**
 * Resolve the single value that represents completed work.
 *
 * `taskTrackedHours` describes how attendance time was attributed and must not
 * be added to attendance time. Flexible attendance callers can provide the
 * already policy-adjusted `creditedWorkSeconds` value.
 */
export function resolveCreditedWorkHours({
  attendanceHours,
  taskTrackedHours: _taskTrackedHours,
  creditedWorkSeconds,
}: AttendanceCreditInput) {
  if (creditedWorkSeconds !== undefined) {
    return Math.max(0, creditedWorkSeconds / 3600);
  }
  return Math.max(0, attendanceHours ?? 0);
}

