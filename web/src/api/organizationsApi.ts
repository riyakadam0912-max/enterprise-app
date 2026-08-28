import { apiClient } from './apiClient';

export interface Organization {
  id: number;
  name: string;
  code: string;
  slug: string;
  status: string;
  createdAt: string;
  parentId?: number | null;
  logoUrl?: string | null;
  number?: string | null;
  adminUser?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  /** ISO 3166-2 state/region code e.g. "MH" */
  state?: string | null;
  /** ISO 3166-1 alpha-2 country code e.g. "IN" */
  country?: string | null;
  /** IANA timezone identifier e.g. "Asia/Kolkata" */
  timezone?: string | null;
  /** ISO 4217 currency code e.g. "INR" */
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

export async function listOrganizations(params?: {
  parentId?: number;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<Organization[]> {
  try {
    const query = new URLSearchParams();
    if (params?.parentId != null) query.set('parentId', String(params.parentId));
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.page != null) query.set('page', String(params.page));
    if (params?.limit != null) query.set('limit', String(params.limit));
    const qs = query.toString();
    return await apiClient<Organization[]>(`/organizations${qs ? `?${qs}` : ''}`);
  } catch (error: unknown) {
    throw error instanceof Error
      ? error
      : new Error('Failed to load organizations');
  }
}

/** List child organizations of the given parent org. */
export async function listChildOrganizations(parentId: number): Promise<Organization[]> {
  return listOrganizations({ parentId });
}

/**
 * Fetch a single organization by ID (Super Admin only).
 * The caller must have X-Organization-Id set on the axios client, or pass
 * the id of any org they are authorised to view.
 */
export async function getOrganizationById(id: number): Promise<Organization> {
  return apiClient<Organization>(`/organizations/${id}`);
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

export async function updateOrganization(
  id: number,
  payload: Partial<Pick<Organization, 'name' | 'slug' | 'email' | 'phone' | 'address' | 'city' | 'state' | 'country' | 'timezone' | 'currency' | 'website' | 'industry' | 'status'>>,
): Promise<Organization> {
  return apiClient<Organization>(`/organizations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...payload, businessEmail: payload.email }),
  });
}

export async function deleteOrganization(id: number): Promise<void> {
  await apiClient(`/organizations/${id}`, { method: 'DELETE' });
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
