import { apiClient } from './apiClient';

export interface Organization {
  id: number;
  name: string;
  code: string;
  slug: string;
  status: string;
  createdAt: string;
  logoUrl?: string | null;
  number?: string | null;
  subscriptionPlan?: string | null;
  adminUser?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  timezone?: string | null;
  currency?: string | null;
  website?: string | null;
  industry?: string | null;
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

export async function getMyOrganization(): Promise<Organization> {
  return apiClient<Organization>('/organizations/me');
}

export async function updateMyOrganization(
  payload: Partial<Pick<Organization, 'name' | 'slug' | 'email' | 'phone' | 'address' | 'city' | 'state' | 'country' | 'timezone' | 'currency' | 'website' | 'industry'>>,
): Promise<Organization> {
  return apiClient<Organization>('/organizations/me', {
    method: 'PATCH',
    body: JSON.stringify({ ...payload, businessEmail: payload.email }),
  });
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
