import { apiClient } from './apiClient';

export interface Organization {
  id: number;
  name: string;
  code: string;
  slug: string;
  status: string;
  createdAt: string;
  number?: string | null;
  subscriptionPlan?: string | null;
  adminUser?: string | null;
}

export interface PlatformStats {
  organizations: {
    total: number;
    newThisMonth: number;
    active: number;
    healthy: number;
  };
  users: {
    total: number;
    active: number;
  };
  security: {
    recentEvents: number;
    requireReview: number;
  };
}

export async function listOrganizations(): Promise<Organization[]> {
  try {
    return await apiClient<Organization[]>('/organizations');
  } catch (error: unknown) {
    throw error instanceof Error
      ? error
      : new Error('Failed to load organizations');
  }
}

export async function getPlatformStats(): Promise<PlatformStats> {
  try {
    return await apiClient<PlatformStats>('/organizations/platform-stats');
  } catch (error: unknown) {
    throw error instanceof Error
      ? error
      : new Error('Failed to load platform statistics');
  }
}
