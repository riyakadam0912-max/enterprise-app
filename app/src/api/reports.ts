import { api, unwrap } from './client';

export type ReportsDashboard = { summaryCards?: { totalEmployees?: number; presentToday?: number; monthlyPayrollCost?: number; attritionRate?: number }; attendanceSummary?: { totalDays?: number; presentDays?: number; absentDays?: number; lateCount?: number; overtimeHours?: number }; payrollSummary?: { totalPayout?: number; totalDeductions?: number; netCost?: number }; turnoverSummary?: { totalEmployees?: number; newHires?: number; resignations?: number; attritionRate?: number }; performanceSummary?: { avgRating?: number; goalCompletionRate?: number }; charts?: { attendanceTrend?: { date: string; present: number; absent: number }[]; payrollCost?: { month: string; netPay: number; deductions: number }[]; employeeGrowth?: { month: string; count: number }[]; performanceDistribution?: { bucket: string; count: number }[] } };

export interface ReportsFilters {
  month?: string;
  department?: string;
  employeeId?: string;
  role?: string;
}

export async function reportsDashboard(filters?: ReportsFilters): Promise<ReportsDashboard> { 
  const params = new URLSearchParams();
  if (filters?.month) params.append('month', filters.month);
  if (filters?.department) params.append('department', filters.department);
  if (filters?.employeeId) params.append('employeeId', filters.employeeId);
  if (filters?.role) params.append('role', filters.role);
  
  const queryString = params.toString();
  const url = queryString ? `/reports/dashboard?${queryString}` : '/reports/dashboard';
  return unwrap<ReportsDashboard>((await api.get(url)).data); 
}
