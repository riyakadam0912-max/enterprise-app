import { apiClient } from './apiClient';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY' | 'WEEKLY_OFF' | 'UPCOMING' | 'NOT_STARTED' | 'NOT_SCHEDULED';

export interface AttendanceSummary {
  present: number;
  absent: number;
  leave: number;
  holiday?: number;
  holidayDays?: number;
  halfDay: number;
  presentDays?: number;
  absentDays?: number;
  leaveDays?: number;
  halfDays?: number;
  lateCount?: number;
  overtimeHours?: number;
  shortfallHours?: number;
  totalWorkedHours?: number;
  totalExpectedHours?: number;
  totalWorkingDays?: number;
}

export interface ShiftDetails {
  id: number | null;
  name: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  requiredHours: number | null;
  minPresentHours?: number | null;
  gracePeriodMinutes: number | null;
  weeklyHolidayDay?: number;
  workingDays?: number[];
}

export interface AttendanceEmployee {
  id: number;
  name: string;
  department: string | null;
  designation: string | null;
  organization?: { id: number; name: string };
}

export interface AttendanceRecord {
  id: number | null;
  employeeId: number;
  employee: AttendanceEmployee;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  checkoutSource?: 'USER' | 'ADMIN_EDIT' | 'AUTO' | null;
  checkoutActorName?: string | null;
  workingHours: number | null;
  breaks?: { startedAt: string; endedAt: string | null }[];
  breakHours?: number;
  onBreak?: boolean;
  shortfallHours?: number;
  lateMinutes: number;
  overtimeHours: number;
  status: AttendanceStatus;
  holidayName?: string | null;
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
  holidayName?: string | null;
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number | null;
  breaks?: { startedAt: string; endedAt: string | null }[];
  onBreak?: boolean;
  shortfallHours?: number;
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
  shortfallHours?: number;
  workingHours?: number | null;
  breaks?: { startedAt: string; endedAt: string | null }[];
  onBreak?: boolean;
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
  shortfallHours?: number;
  totalWorkedHours?: number;
  totalExpectedHours?: number;
  totalWorkingDays: number;
}

export interface WorkHourPeriodBalance {
  startDate: string;
  endDate: string;
  requiredHours: number;
  completedHours: number;
  breakHours: number;
  remainingHours: number;
  progressPercent: number;
  scheduledDays: number;
  fullPeriodRequiredHours?: number;
  fullPeriodScheduledDays?: number;
}

export interface WorkHourBalances {
  week: WorkHourPeriodBalance;
  month: WorkHourPeriodBalance;
}

export interface ShiftPayload {
  name: string;
  type: 'FIXED' | 'FLEXIBLE' | 'ROTATIONAL';
  startTime?: string;
  endTime?: string;
  requiredHours?: number;
  minPresentHours?: number;
  gracePeriodMinutes?: number;
  weeklyHolidayDay?: number;
  workingDays?: number[];
  rotationPattern?: string;
}

export interface ShiftRecord extends ShiftPayload {
  id: number;
  isActive?: boolean;
}

export interface TeamWeeklyWorkHours {
  employees: Array<{
    employeeId: number;
    employeeName: string;
    department: string | null;
    week: WorkHourPeriodBalance;
  }>;
}

export interface HolidayRecord {
  id: number;
  startDate: string;
  endDate: string;
  name: string;
  organizationId: number;
  familyRootOrganizationId?: number | null;
  canManage?: boolean;
}

export interface HolidayPayload {
  startDate: string;
  endDate: string;
  name: string;
  familyWide?: boolean;
}

export interface AttendanceFilters {
  page?: number;
  limit?: number;
  employeeId?: number;
  department?: string;
  date?: string;
  status?: AttendanceStatus;
}

export interface MonthlyAttendanceReportRow {
  employeeId: number;
  employeeName: string;
  organization: { id: number; name: string };
  hireDate: string | null;
  department: string | null;
  role: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  leaveCount: number;
  holidayCount: number;
  weeklyOffCount: number;
  workingDays: number;
  attendancePercent: number;
  overtimeHours?: number;
  shortfallHours?: number;
  totalWorkedHours?: number;
  totalExpectedHours?: number;
}

export interface MonthlyAttendanceReportResponse {
  month: string;
  year: number;
  rows: MonthlyAttendanceReportRow[];
  total: number;
}

export interface MonthlyAttendanceReportFilters {
  month?: string;
  year?: string;
  employeeId?: number;
  department?: string;
  status?: AttendanceStatus | 'LATE' | '';
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
  breaks?: { startedAt: string; endedAt: string | null }[];
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

export function getWorkHourBalances(): Promise<WorkHourBalances> {
  return apiClient<WorkHourBalances>('/attendance/work-hours');
}

export function getTeamWeeklyWorkHours(): Promise<TeamWeeklyWorkHours> {
  return apiClient<TeamWeeklyWorkHours>('/attendance/work-hours/team');
}

export function startAttendanceBreak(): Promise<unknown> {
  return apiClient('/attendance/break/start', { method: 'POST' });
}

export function stopAttendanceBreak(): Promise<unknown> {
  return apiClient('/attendance/break/stop', { method: 'POST' });
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

export function getMonthlyAttendanceReport(filters: MonthlyAttendanceReportFilters = {}): Promise<MonthlyAttendanceReportResponse> {
  return apiClient<MonthlyAttendanceReportResponse>(`/attendance/monthly-report${buildQuery({
    month: filters.month,
    year: filters.year,
    employeeId: filters.employeeId,
    department: filters.department,
    status: filters.status,
  })}`);
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

export function updateShift(id: number, data: Partial<ShiftPayload>): Promise<ShiftRecord> {
  return apiClient<ShiftRecord>(`/attendance/shifts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteShift(id: number): Promise<unknown> {
  return apiClient(`/attendance/shifts/${id}`, {
    method: 'DELETE',
  });
}

function isDateValue(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function normalizeHolidayRecords(payload: unknown): HolidayRecord[] {
  if (!Array.isArray(payload)) {
    throw new Error('The holidays response is not a list.');
  }

  return payload.flatMap((value): HolidayRecord[] => {
    if (typeof value !== 'object' || value === null) return [];
    const record = value as Record<string, unknown>;
    const legacyDate = isDateValue(record.date) ? record.date : undefined;
    const startDate = isDateValue(record.startDate) ? record.startDate : legacyDate;
    const endDate = isDateValue(record.endDate) ? record.endDate : legacyDate ?? startDate;

    if (
      typeof record.id !== 'number' ||
      typeof record.name !== 'string' ||
      typeof record.organizationId !== 'number' ||
      !startDate ||
      !endDate
    ) {
      return [];
    }

    return [{
      id: record.id,
      startDate,
      endDate,
      name: record.name,
      organizationId: record.organizationId,
    }];
  });
}

export async function getHolidays(): Promise<HolidayRecord[]> {
  const payload = await apiClient<unknown>('/attendance/holidays');
  return normalizeHolidayRecords(payload);
}

export function createHoliday(data: HolidayPayload): Promise<HolidayRecord> {
  return apiClient<HolidayRecord>('/attendance/holidays', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateHoliday(id: number, data: Partial<HolidayPayload>): Promise<HolidayRecord> {
  return apiClient<HolidayRecord>(`/attendance/holidays/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteHoliday(id: number): Promise<unknown> {
  return apiClient(`/attendance/holidays/${id}`, { method: 'DELETE' });
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
