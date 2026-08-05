import { apiClient } from './apiClient';

export interface GoalCycle {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt?: string;
  _count?: {
    goals?: number;
    reviews?: number;
  };
}

export interface Goal {
  id: number;
  title: string;
  description?: string | null;
  weightage?: number | null;
  targetMetric?: string | null;
  status?: string;
  employee?: {
    id: number;
    name: string;
    department?: string | null;
  };
  goalCycle?: {
    id: number;
    name: string;
  };
}

export interface PerformanceReview {
  id: number;
  rating?: number | null;
  summary?: string | null;
  status?: string;
  submittedAt?: string | null;
  employee?: {
    id: number;
    name: string;
  };
  goalCycle?: {
    id: number;
    name: string;
  };
}

export function getGoalCycles(): Promise<GoalCycle[]> {
  return apiClient<GoalCycle[]>('/performance/goal-cycles');
}

export function getGoals(employeeId?: number): Promise<Goal[]> {
  const query = employeeId ? `?employeeId=${employeeId}` : '';
  return apiClient<Goal[]>(`/performance/goals${query}`);
}

export function getReviews(employeeId?: number): Promise<PerformanceReview[]> {
  const query = employeeId ? `?employeeId=${employeeId}` : '';
  return apiClient<PerformanceReview[]>(`/performance/reviews${query}`);
}
