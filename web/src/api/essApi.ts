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
  status: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT';
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number;
  lateMinutes?: number;
  overtimeHours?: number;
  shift: {
    name: string;
    startTime: string;
    endTime: string;
    requiredHours: number;
  } | null;
}

export interface AttendanceRecord {
  date: string;
  status: string;
  checkIn: string;
  checkOut: string | null;
  workingHours: number;
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
  year: number;
}

export interface LeaveRecord {
  id: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
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

// Attendance API Functions
export async function checkIn(): Promise<CheckInResponse> {
  return apiClient<CheckInResponse>('/ess/attendance/check-in', {
    method: 'POST',
  });
}

export async function checkOut(): Promise<CheckOutResponse> {
  return apiClient<CheckOutResponse>('/ess/attendance/check-out', {
    method: 'POST',
  });
}

export async function getAttendanceToday(): Promise<AttendanceStatus> {
  return apiClient<AttendanceStatus>('/ess/attendance/today');
}

export async function getAttendanceHistory(): Promise<AttendanceRecord[]> {
  return apiClient<AttendanceRecord[]>('/ess/attendance/history');
}

// Leave API Functions
export async function applyLeave(data: {
  startDate: string;
  endDate: string;
  leaveType: string;
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
