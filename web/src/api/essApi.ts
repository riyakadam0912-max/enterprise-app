import { apiClient } from './apiClient';

// Types
export interface CheckInResponse {
  checkIn: string;
  lateMinutes: number;
  shift: {
    name: string;
    startTime: string;
    endTime: string;
  } | null;
}

export interface CheckOutResponse {
  checkIn: string;
  checkOut: string;
  workingHours: number;
  overtimeHours: number;
  late: boolean;
  lateMinutes: number;
}

export interface AttendanceStatus {
  capabilities?: { canCheckIn: boolean; canCheckOut: boolean; canBreak: boolean };
  activeAttendance?: { kind: 'IDLE' | 'SESSION' | 'REVIEW_REQUIRED'; startedAt: string | null; message: string | null };
  status: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT';
  activeSession: { startedAt: string } | null;
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number;
  breaks?: { startedAt: string; endedAt: string | null }[];
  onBreak?: boolean;
  lateMinutes?: number;
  overtimeHours?: number;
  shift: {
    name: string;
    startTime: string;
    endTime: string;
    requiredHours: number;
    type?: string;
  } | null;
}

export interface AttendanceRecord {
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number | null;
  lateMinutes: number;
  overtimeHours: number;
  shift: {
    name: string;
    startTime: string;
    endTime: string;
  } | null;
}

export interface LeaveResponse {
  id: number;
  requestType?: 'LEAVE' | 'WORK_FROM_HOME';
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
  days: number;
}

export interface LeaveBalance {
  totalAllocation: number;
  daysTaken: number;
  balance: number;
  compOffAvailable: number;
  year: number;
}

export interface LeaveRecord {
  id: number;
  requestType?: 'LEAVE' | 'WORK_FROM_HOME';
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  duration?: 'FULL_DAY' | 'HALF_DAY';
  days: number;
  appliedOn: string;
}

export interface PayslipSummary {
  id: number;
  month: number;
  year: number;
  grossEarnings: number;
  netPay: number;
  status: string;
  generatedAt: string;
  downloadedAt: string | null;
}

export interface PayslipDetails {
  month: number;
  year: number;
  earnings: {
    basic: number;
    hra: number;
    allowances: number;
    bonus: number;
    overtime: number;
    reimbursements: number;
    total: number;
  };
  deductions: {
    pf: number;
    esi: number;
    professionalTax: number;
    tds: number;
    lossOfPay: number;
    lateMarkPenalty: number;
    other: number;
    total: number;
  };
  netPay: number;
  attendance: {
    workingDays: number;
    presentDays: number;
    absenceDays: number;
    paidLeave: number;
    unpaidLeave: number;
    lateCount: number;
    overtimeHours: number;
  };
  generatedAt: string;
}

export interface ExpenseResponse {
  id: number;
  amount: number;
  category: string;
  status: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: number;
  date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  submittedAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
}

export interface ExpenseDetails {
  id: number;
  date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  receiptImage: string | null;
  submittedAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  approvalTrail: unknown;
}

export interface EmployeeProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  phoneNumber: string;
  position: string;
  designation: string;
  department: string;
  hireDate: string;
  manager: string;
  shift: {
    id: number;
    name: string;
    type: string;
  } | null;
  address: string;
  emergencyContact: string;
  emergencyContactPhone: string;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;

const getString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const getNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const normalizeShift = (shift: unknown): AttendanceStatus['shift'] => {
  if (!isRecord(shift)) return null;
  const name = getString(shift.name);
  if (!name) return null;

  return {
    name,
    startTime: getString(shift.startTime) ?? '',
    endTime: getString(shift.endTime) ?? '',
    requiredHours: getNumber(shift.requiredHours) ?? 0,
    type: getString(shift.type) ?? undefined,
  };
};

const normalizeCompactShift = (shift: unknown): AttendanceRecord['shift'] => {
  if (!isRecord(shift)) return null;
  const name = getString(shift.name);
  if (!name) return null;

  return {
    name,
    startTime: getString(shift.startTime) ?? '',
    endTime: getString(shift.endTime) ?? '',
  };
};

const deriveEssStatus = (checkIn: string | null, checkOut: string | null): AttendanceStatus['status'] => {
  if (!checkIn) return 'NOT_CHECKED_IN';
  if (!checkOut) return 'CHECKED_IN';
  return 'CHECKED_OUT';
};

// Attendance API Functions
export async function checkIn(): Promise<CheckInResponse> {
  const result = await apiClient<unknown>('/attendance/check-in', {
    method: 'POST',
  });

  if (!isRecord(result)) {
    return { checkIn: '', lateMinutes: 0, shift: null };
  }

  const checkInValue = getString(result.checkIn) ?? '';
  const lateMinutes = getNumber(result.lateMinutes) ?? 0;
  const shift = normalizeCompactShift(result.shift);

  return { checkIn: checkInValue, lateMinutes, shift };
}

export async function checkOut(): Promise<CheckOutResponse> {
  const result = await apiClient<unknown>('/attendance/check-out', {
    method: 'POST',
  });

  if (!isRecord(result)) {
    return {
      checkIn: '',
      checkOut: '',
      workingHours: 0,
      overtimeHours: 0,
      late: false,
      lateMinutes: 0,
    };
  }

  const checkInValue = getString(result.checkIn) ?? '';
  const checkOutValue = getString(result.checkOut) ?? '';
  const workingHours = getNumber(result.workingHours) ?? 0;
  const overtimeHours = getNumber(result.overtimeHours) ?? 0;
  const lateMinutes = getNumber(result.lateMinutes) ?? 0;

  return {
    checkIn: checkInValue,
    checkOut: checkOutValue,
    workingHours,
    overtimeHours,
    late: lateMinutes > 0,
    lateMinutes,
  };
}

export async function startAttendanceBreak() {
  return apiClient<unknown>('/attendance/break/start', { method: 'POST' });
}

export async function stopAttendanceBreak() {
  return apiClient<unknown>('/attendance/break/stop', { method: 'POST' });
}

export async function getAttendanceToday(): Promise<AttendanceStatus> {
  const result = await apiClient<unknown>('/attendance/my');
  if (!isRecord(result)) {
    return {
      status: 'NOT_CHECKED_IN',
      activeSession: null,
      checkIn: null,
      checkOut: null,
      workingHours: 0,
      breaks: [],
      onBreak: false,
      lateMinutes: 0,
      overtimeHours: 0,
      shift: null,
    };
  }

  const session = isRecord(result.activeSession)
    ? result.activeSession
    : null;
  const activeSessionStartedAt = session
    ? getString(session.startedAt)
    : null;
  const checkInValue = activeSessionStartedAt ?? getString(result.checkIn);
  const checkOutValue = activeSessionStartedAt
    ? null
    : getString(result.checkOut);
  const workingHours = getNumber(result.workingHours) ?? 0;
  const lateMinutes = getNumber(result.lateMinutes) ?? 0;
  const overtimeHours = getNumber(result.overtimeHours) ?? 0;
  const shift = normalizeShift(result.shiftDetails ?? result.shift);
  const breaks = Array.isArray(result.breaks)
    ? result.breaks.flatMap((item) => isRecord(item) && getString(item.startedAt)
      ? [{ startedAt: getString(item.startedAt)!, endedAt: getString(item.endedAt) ?? null }]
      : [])
    : [];

  return {
    capabilities: isRecord(result.capabilities) ? result.capabilities as AttendanceStatus['capabilities'] : undefined,
    activeAttendance: isRecord(result.activeAttendance) ? result.activeAttendance as AttendanceStatus['activeAttendance'] : undefined,
    activeSession: activeSessionStartedAt
      ? { startedAt: activeSessionStartedAt }
      : null,
    status: deriveEssStatus(checkInValue, checkOutValue),
    checkIn: checkInValue,
    checkOut: checkOutValue,
    workingHours,
    breaks,
    onBreak: result.onBreak === true,
    lateMinutes,
    overtimeHours,
    shift,
  };
}

export async function getAttendanceHistory(): Promise<AttendanceRecord[]> {
  const result = await apiClient<unknown>('/attendance/me?limit=10&page=1');
  if (!isRecord(result) || !Array.isArray(result.data)) {
    return [];
  }

  const records: AttendanceRecord[] = [];
  result.data.forEach((row) => {
    if (!isRecord(row)) return;
    const date = getString(row.date);
    if (!date) return;

    records.push({
      date,
      status: getString(row.status) ?? 'ABSENT',
      checkIn: getString(row.checkIn),
      checkOut: getString(row.checkOut),
      workingHours: getNumber(row.workingHours),
      lateMinutes: getNumber(row.lateMinutes) ?? 0,
      overtimeHours: getNumber(row.overtimeHours) ?? 0,
      shift: normalizeCompactShift(row.shiftDetails ?? row.shift),
    });
  });

  return records;
}

// Leave API Functions
export async function applyLeave(data: {
  requestType?: 'LEAVE' | 'WORK_FROM_HOME';
  startDate: string;
  endDate: string;
  duration?: 'FULL_DAY' | 'HALF_DAY';
  leaveType?: string;
  reason?: string;
}): Promise<LeaveResponse> {
  return apiClient<LeaveResponse>('/ess/leave/apply', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getLeaveBalance(): Promise<LeaveBalance> {
  return apiClient<LeaveBalance>('/ess/leave/balance');
}

export async function getLeaveHistory(): Promise<LeaveRecord[]> {
  return apiClient<LeaveRecord[]>('/ess/leave/history');
}

// Payslip API Functions
export async function getMyPayslips(): Promise<PayslipSummary[]> {
  return apiClient<PayslipSummary[]>('/ess/payslip/list');
}

export async function getLastPayslip(): Promise<PayslipSummary | null> {
  return apiClient<PayslipSummary | null>('/ess/payslip/last');
}

export async function getPayslipDetails(payslipId: number): Promise<PayslipDetails> {
  return apiClient<PayslipDetails>(`/ess/payslip/${payslipId}`);
}

// Expense API Functions
export async function submitExpense(data: {
  amount: number;
  category: string;
  description: string;
  expenseDate?: string;
  currency?: string;
}): Promise<ExpenseResponse> {
  return apiClient<ExpenseResponse>('/ess/expense/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMyExpenses(): Promise<ExpenseRecord[]> {
  return apiClient<ExpenseRecord[]>('/ess/expense/list');
}

export async function getExpenseDetails(expenseId: number): Promise<ExpenseDetails> {
  return apiClient<ExpenseDetails>(`/ess/expense/${expenseId}`);
}

// Profile API Functions
export async function getMyProfile(): Promise<EmployeeProfile> {
  return apiClient<EmployeeProfile>('/ess/profile/me');
}

export async function updateMyProfile(data: {
  phoneNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyContactPhone?: string;
}): Promise<unknown> {
  return apiClient<unknown>('/ess/profile/update', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
