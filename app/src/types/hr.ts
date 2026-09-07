export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE';

export type AttendanceSummary = {
  present: number;
  absent: number;
  leave: number;
  halfDay: number;
  lateCount?: number;
  overtimeHours?: number;
  shortfallHours?: number;
  totalWorkedHours?: number;
  totalExpectedHours?: number;
  totalWorkingDays?: number;
};

export type ShiftSummary = {
  id?: number | null;
  name: string;
  type?: string;
  startTime: string;
  endTime: string;
  requiredHours?: number | null;
  minPresentHours?: number | null;
  gracePeriodMinutes?: number | null;
};

export type AttendanceToday = {
  date: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  workingHours?: number | null;
  lateMinutes: number;
  overtimeHours: number;
  shortfallHours?: number;
  shift: ShiftSummary | null;
};

export type AttendanceRecord = {
  date: string;
  id?: number | null;
  employeeId?: number;
  employee?: { id: number; name: string; department?: string | null; designation?: string | null };
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number | null;
  shortfallHours?: number;
  lateMinutes: number;
  overtimeHours: number;
  shift: ShiftSummary | null;
};

export type TeamAttendance = {
  date: string;
  rows: AttendanceRecord[];
  summary: AttendanceSummary;
};

export type LeaveRecord = {
  id: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  days: number;
  appliedOn: string;
};

export type LeaveBalance = {
  totalAllocation: number;
  daysTaken: number;
  balance: number;
  year: number;
};

export type LeaveApplication = {
  startDate: string;
  endDate: string;
  leaveType: string;
  reason?: string;
};