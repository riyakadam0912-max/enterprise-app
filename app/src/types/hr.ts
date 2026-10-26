export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";

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
  capabilities?: {
    canCheckIn: boolean;
    canCheckOut: boolean;
    canBreak: boolean;
  };
  activeAttendance?: {
    kind: "IDLE" | "SESSION" | "REVIEW_REQUIRED";
    startedAt: string | null;
    message: string | null;
  };
  date: string;
  status: AttendanceStatus;
  isShootDay?: boolean;
  activeSession?: { startedAt: string } | null;
  checkIn: string | null;
  checkOut: string | null;
  workingHours?: number | null;
  creditedWorkSeconds?: number;
  workFromHomeCredit?: number;
  breaks?: { startedAt: string; endedAt: string | null }[];
  onBreak?: boolean;
  lateMinutes: number;
  overtimeHours: number;
  shortfallHours?: number;
  shift: ShiftSummary | null;
};

export type AttendanceRecord = {
  date: string;
  id?: number | null;
  employeeId?: number;
  employee?: {
    id: number;
    name: string;
    department?: string | null;
    designation?: string | null;
    organization?: { id: number; name: string };
  };
  status: string;
  isShootDay?: boolean;
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number | null;
  creditedWorkSeconds?: number;
  workFromHomeCredit?: number;
  breaks?: { startedAt: string; endedAt: string | null }[];
  breakHours?: number;
  onBreak?: boolean;
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
  requestType?: "LEAVE" | "WORK_FROM_HOME";
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  duration?: "FULL_DAY" | "HALF_DAY";
  days: number;
  appliedOn: string;
};

export type LeaveBalance = {
  totalAllocation: number;
  daysTaken: number;
  balance: number;
  compOffAvailable: number;
  year: number;
};

export type LeaveApplication = {
  startDate: string;
  endDate: string;
  requestType?: "LEAVE" | "WORK_FROM_HOME";
  leaveType?: string;
  reason?: string;
};
