import { axiosClient } from './axiosClient';
import type { ApiResponseEnvelope } from '@/types/api';

export interface AbsenteeismSummary {
  totalEmployees: number;
  presentCount: number;
  absenteeismRate: number;
}

export interface BurnRateSummary {
  payroll: number;
  expenses: number;
  total: number;
}

export interface RevenueVelocitySummary {
  averageDays: number;
}

export interface AnalyticsSummary {
  absenteeism: AbsenteeismSummary;
  burnRate: BurnRateSummary;
  revenueVelocity: RevenueVelocitySummary;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const response = await axiosClient.get<ApiResponseEnvelope<AnalyticsSummary>>('/analytics/summary');

  if (!response.data.success) {
    throw new Error(response.data.message || 'API request failed');
  }

  return response.data.data;
}
