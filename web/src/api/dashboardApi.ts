import { apiClient } from './apiClient';

export interface DashboardStats {
  totalEmployees:  number;
  totalLeads:      number;
  totalTasks:      number;
  totalInvoices:   number;
  totalRevenue:    number;
  totalAttendanceRows?: number;
  absenteeismRate: number;
  revenuePerLead: number;
  conversionRate: number;
  tasksByStatus:   Record<string, number>;
  leadsByStatus:   Record<string, number>;
  totalDeals:      number;
  wonDeals:        number;
  lostDeals:       number;
  pipelineValue:   number;
  leadConversionRate: number;
  dealsByStage:    Record<string, number>;
  revenueByMonth:  { month: string; revenue: number }[];
  hr?: {
    pendingManagerLeaves: number;
    pendingHrLeaves: number;
    pendingExpenses: number;
    approvedThisMonthLeaves: number;
    rejectedThisMonthLeaves: number;
    attendanceToday: Record<string, number>;
  };
  workflow?: {
    pendingLeaves: number;
    pendingExpenses: number;
    agingApprovals: number;
    overdueApprovals: number;
    recentActivity: {
      id: string;
      type: 'LEAVE' | 'EXPENSE';
      action: 'SUBMITTED' | 'MANAGER_APPROVED' | 'HR_APPROVED' | 'REJECTED';
      title: string;
      at: string;
      status: string;
      href: string;
    }[];
  };
}

export function getDashboardStats(): Promise<DashboardStats> {
  return apiClient<DashboardStats>('/dashboard');
}
