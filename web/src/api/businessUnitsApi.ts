import { apiClient } from './apiClient';

export type BusinessUnitStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface BusinessUnit {
  id: number;
  organizationId: number;
  parentId: number | null;
  name: string;
  code: string;
  description: string | null;
  type: string | null;
  status: BusinessUnitStatus;
  parent?: Pick<BusinessUnit, 'id' | 'name' | 'code'> | null;
  children?: Array<Pick<BusinessUnit, 'id' | 'name' | 'code' | 'status'>>;
  _count?: { users: number; employees: number; children: number };
}

export interface BusinessUnitPayload {
  name: string;
  code: string;
  description?: string;
  type?: string;
  status?: BusinessUnitStatus;
  parentId?: number | null;
}

export interface BusinessUnitAdministrator {
  id: number;
  userId: number;
  businessUnitId: number;
  organizationId: number;
  createdAt: string;
  user: { id: number; name: string; email: string; role: string };
}

export interface BusinessUnitAdministratorCandidate {
  id: number;
  name: string;
  email: string;
  role: string;
}

export function listBusinessUnits(organizationId: number): Promise<BusinessUnit[]> {
  return apiClient<BusinessUnit[]>(`/organizations/${organizationId}/business-units`);
}

export function createBusinessUnit(organizationId: number, payload: BusinessUnitPayload): Promise<BusinessUnit> {
  return apiClient<BusinessUnit>(`/organizations/${organizationId}/business-units`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateBusinessUnit(id: number, payload: Partial<BusinessUnitPayload>): Promise<BusinessUnit> {
  return apiClient<BusinessUnit>(`/business-units/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteBusinessUnit(id: number): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(`/business-units/${id}`, { method: 'DELETE' });
}

export function listBusinessUnitAdministrators(organizationId: number, businessUnitId: number): Promise<BusinessUnitAdministrator[]> {
  return apiClient<BusinessUnitAdministrator[]>(`/organizations/${organizationId}/business-units/${businessUnitId}/admins`);
}

export function listBusinessUnitAdministratorCandidates(organizationId: number, businessUnitId: number): Promise<BusinessUnitAdministratorCandidate[]> {
  return apiClient<BusinessUnitAdministratorCandidate[]>(`/organizations/${organizationId}/business-units/${businessUnitId}/admin-candidates`);
}

export function assignBusinessUnitAdministrator(organizationId: number, businessUnitId: number, userId: number): Promise<BusinessUnitAdministrator> {
  return apiClient<BusinessUnitAdministrator>(`/organizations/${organizationId}/business-units/${businessUnitId}/admins/${userId}`, {
    method: 'POST',
  });
}

export function revokeBusinessUnitAdministrator(organizationId: number, businessUnitId: number, userId: number): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(`/organizations/${organizationId}/business-units/${businessUnitId}/admins/${userId}`, {
    method: 'DELETE',
  });
}
