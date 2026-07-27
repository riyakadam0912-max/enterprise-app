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

export async function listOrganizations(): Promise<Organization[]> {
  try {
    return await apiClient<Organization[]>('/organizations');
  } catch (error: unknown) {
    throw error instanceof Error
      ? error
      : new Error('Failed to load organizations');
  }
}
