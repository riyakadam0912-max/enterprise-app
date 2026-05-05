import { apiClient } from './apiClient';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE';

export interface AttendanceSummary {
  present: number;
  absent: number;
  leave: number;
  halfDay: number;
  presentDays?: number;
  absentDays?: number;
  leaveDays?: number;
  halfDays?: number;
  lateCount?: number;
  overtimeHours?: number;
  totalWorkingDays?: number;
}

export interface ShiftDetails {
  id: number | null;
  name: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  requiredHours: number | null;
  gracePeriodMinutes: number | null;
}

export interface AttendanceEmployee {
  id: number;
  name: string;
  department: string | null;
  designation: string | null;
}

export interface AttendanceRecord {
  id: number | null;
  employeeId: number;
  employee: AttendanceEmployee;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number | null;
  lateMinutes: number;
  overtimeHours: number;
  status: AttendanceStatus;
  shiftDetails: ShiftDetails | null;
}

export interface AttendanceListResponse {
  data: AttendanceRecord[];
  total: number;
  page: number;
  limit: number;
  date: string;
  summary: AttendanceSummary;
}

export interface TodayAttendanceResponse {
  date: string;
  rows: AttendanceRecord[];
  summary: AttendanceSummary;
}

export interface EmployeeAttendanceDay {
  date: string;
  day: number;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number | null;
  lateMinutes: number;
  overtimeHours: number;
  shiftDetails: ShiftDetails | null;
}

export interface EmployeeAttendanceResponse {
  employee: {
    id: number;
    name: string;
    email?: string;
    department?: string;
    designation?: string;
    shift?: ShiftDetails | null;
  };
  month: string;
  summary: AttendanceSummary;
  days: EmployeeAttendanceDay[];
}

export interface MyAttendanceResponse {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  overtimeHours: number;
  status: AttendanceStatus;
  shiftDetails: ShiftDetails | null;
}

export interface AttendanceMonthlySummary {
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  halfDays: number;
  lateCount: number;
  overtimeHours: number;
  totalWorkingDays: number;
}

export interface ShiftPayload {
  name: string;
  type: 'FIXED' | 'FLEXIBLE' | 'ROTATIONAL';
  startTime?: string;
  endTime?: string;
  requiredHours?: number;
  gracePeriodMinutes?: number;
  rotationPattern?: string;
}

export interface ShiftRecord extends ShiftPayload {
  id: number;
  isActive?: boolean;
}

export interface AttendanceFilters {
  page?: number;
  limit?: number;
  employeeId?: number;
  department?: string;
  date?: string;
  status?: AttendanceStatus;
}

export interface AttendanceActionPayload {
  employeeId?: number;
  date?: string;
  timestamp?: string;
}

export interface UpdateAttendancePayload {
  date?: string;
  checkIn?: string;
  checkOut?: string;
  status?: AttendanceStatus;
}

function buildQuery(filters: { [key: string]: string | number | undefined | null }) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getAttendance(filters: AttendanceFilters = {}): Promise<AttendanceListResponse> {
  return apiClient<AttendanceListResponse>(
    `/attendance${buildQuery({
      page: filters.page,
      limit: filters.limit,
      employeeId: filters.employeeId,
      department: filters.department,
      date: filters.date,
      status: filters.status,
    })}`,
  );
}

export function getMyAttendance(filters: AttendanceFilters = {}): Promise<AttendanceListResponse> {
  return apiClient<AttendanceListResponse>(
    `/attendance/me${buildQuery({
      page: filters.page,
      limit: filters.limit,
      date: filters.date,
      status: filters.status,
    })}`,
  );
}

export function getMyAttendanceSnapshot(): Promise<MyAttendanceResponse> {
  return apiClient<MyAttendanceResponse>('/attendance/my');
}

export function getTodayAttendance(date?: string): Promise<TodayAttendanceResponse> {
  return apiClient<TodayAttendanceResponse>(`/attendance/today${buildQuery({ date })}`);
}

export function getEmployeeAttendance(employeeId: number, month?: string): Promise<EmployeeAttendanceResponse> {
  return apiClient<EmployeeAttendanceResponse>(`/attendance/employee/${employeeId}${buildQuery({ month })}`);
}

export function getAttendanceSummary(month?: string, employeeId?: number): Promise<AttendanceMonthlySummary> {
  return apiClient<AttendanceMonthlySummary>(`/attendance/summary${buildQuery({ month, employeeId })}`);
}

export function getShifts(): Promise<ShiftRecord[]> {
  return apiClient<ShiftRecord[]>('/attendance/shifts');
}

export function createShift(data: ShiftPayload): Promise<ShiftRecord> {
  return apiClient<ShiftRecord>('/attendance/shifts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function assignShift(employeeId: number, shiftId: number): Promise<unknown> {
  return apiClient('/attendance/shifts/assign', {
    method: 'POST',
    body: JSON.stringify({ employeeId, shiftId }),
  });
}

export function checkIn(data: AttendanceActionPayload): Promise<AttendanceRecord> {
  return apiClient<AttendanceRecord>('/attendance/check-in', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function checkOut(data: AttendanceActionPayload): Promise<AttendanceRecord> {
  return apiClient<AttendanceRecord>('/attendance/check-out', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAttendance(id: number, data: UpdateAttendancePayload): Promise<AttendanceRecord> {
  return apiClient<AttendanceRecord>(`/attendance/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
