import { api, unwrap } from './client';

export type DashboardStats = {
	totalEmployees?: number;
	totalTasks?: number;
	totalRevenue?: number;
	totalDeals?: number;
	pipelineValue?: number;
	tasksByStatus?: Record<string, number>;
	dealsByStage?: Record<string, number>;
	revenueByMonth?: { month: string; revenue: number }[];
	hr?: { pendingManagerLeaves?: number; pendingHrLeaves?: number; pendingExpenses?: number; attendanceToday?: Record<string, number> };
	workflow?: { pendingLeaves?: number; pendingExpenses?: number; agingApprovals?: number; overdueApprovals?: number; recentActivity?: { id: string; type: string; action: string; title: string; at: string; status: string }[] };
};

export async function dashboard(): Promise<DashboardStats> { return unwrap<DashboardStats>((await api.get('/dashboard')).data); }
