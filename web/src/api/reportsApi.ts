import { apiClient } from './apiClient';

export interface ReportsFilters {
  month?: string;
  from?: string;
  to?: string;
  department?: string;
  employeeId?: number;
  role?: 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';
  page?: number;
  limit?: number;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateCount: number;
  overtimeHours: number;
}

export interface PayrollSummary {
  totalPayout: number;
  totalDeductions: number;
  totalBonuses: number;
  netCost: number;
}

export interface TurnoverSummary {
  totalEmployees: number;
  newHires: number;
  resignations: number;
  attritionRate: number;
}

export interface PerformerRecord {
  employeeId: number;
  name: string;
  department: string;
  rating: number;
  reviewCount: number;
}

export interface PerformanceSummary {
  avgRating: number;
  topPerformers: PerformerRecord[];
  lowPerformers: PerformerRecord[];
  goalCompletionRate: number;
}

export interface AttendanceTrendPoint {
  date: string;
  present: number;
  absent: number;
}

export interface PayrollCostPoint {
  month: string;
  netPay: number;
  deductions: number;
}

export interface EmployeeGrowthPoint {
  month: string;
  count: number;
}

export interface PerformanceDistributionPoint {
  bucket: string;
  count: number;
}

export interface AttendanceBreakdownRow {
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  overtimeHours: number;
  employeeId: number | null;
  employeeName: string;
  department: string;
}

export interface RecentHireRow {
  id: number;
  name: string;
  department: string | null;
  designation: string | null;
  hireDate: string | null;
}

export interface ReportsDashboard {
  attendanceSummary: AttendanceSummary;
  payrollSummary: PayrollSummary;
  turnoverSummary: TurnoverSummary;
  performanceSummary: PerformanceSummary;
  summaryCards: {
    totalEmployees: number;
    presentToday: number;
    monthlyPayrollCost: number;
    attritionRate: number;
  };
  charts: {
    attendanceTrend: AttendanceTrendPoint[];
    payrollCost: PayrollCostPoint[];
    employeeGrowth: EmployeeGrowthPoint[];
    performanceDistribution: PerformanceDistributionPoint[];
  };
  tables: {
    topPerformers: PerformerRecord[];
    recentHires: RecentHireRow[];
    attendanceBreakdown: AttendanceBreakdownRow[];
  };
}

export interface AttendanceDepartmentBreakdown {
  department: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  attendanceRate: number;
}

export interface PayrollDepartmentDistribution {
  department: string;
  total: number;
}

export interface PaginatedAttendanceBreakdown {
  records: AttendanceBreakdownRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function getFromReportsApi<T>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint);
}

function buildQuery(filters: ReportsFilters = {}) {
  const query = new URLSearchParams();
  if (filters.month) query.set('month', filters.month);
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  if (filters.department) query.set('department', filters.department);
  if (typeof filters.employeeId === 'number') query.set('employeeId', String(filters.employeeId));
  if (filters.role) query.set('role', filters.role);
  if (typeof filters.page === 'number') query.set('page', String(filters.page));
  if (typeof filters.limit === 'number') query.set('limit', String(filters.limit));

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export function getReportsDashboard(filters: ReportsFilters = {}): Promise<ReportsDashboard> {
  return getFromReportsApi<ReportsDashboard>(`/reports/dashboard${buildQuery(filters)}`);
}

export function getAttendanceSummary(filters: ReportsFilters = {}): Promise<AttendanceSummary> {
  return getFromReportsApi<AttendanceSummary>(`/reports/attendance${buildQuery(filters)}`);
}

export function getAttendanceDaily(filters: ReportsFilters = {}): Promise<PaginatedAttendanceBreakdown> {
  return getFromReportsApi<PaginatedAttendanceBreakdown>(`/reports/attendance/daily${buildQuery(filters)}`);
}

export function getAttendanceByDepartment(filters: ReportsFilters = {}): Promise<AttendanceDepartmentBreakdown[]> {
  return getFromReportsApi<AttendanceDepartmentBreakdown[]>(`/reports/attendance/departments${buildQuery(filters)}`);
}

export function getPayrollSummary(filters: ReportsFilters = {}): Promise<PayrollSummary> {
  return getFromReportsApi<PayrollSummary>(`/reports/payroll${buildQuery(filters)}`);
}

export function getPayrollByDepartment(filters: ReportsFilters = {}): Promise<PayrollDepartmentDistribution[]> {
  return getFromReportsApi<PayrollDepartmentDistribution[]>(`/reports/payroll/departments${buildQuery(filters)}`);
}

export function getPayrollTrends(filters: ReportsFilters = {}): Promise<PayrollCostPoint[]> {
  return getFromReportsApi<PayrollCostPoint[]>(`/reports/payroll/trends${buildQuery(filters)}`);
}

export function getTurnoverSummary(filters: ReportsFilters = {}): Promise<TurnoverSummary> {
  return getFromReportsApi<TurnoverSummary>(`/reports/turnover${buildQuery(filters)}`);
}

export function getPerformanceSummary(filters: ReportsFilters = {}): Promise<PerformanceSummary> {
  return getFromReportsApi<PerformanceSummary>(`/reports/performance${buildQuery(filters)}`);
}
