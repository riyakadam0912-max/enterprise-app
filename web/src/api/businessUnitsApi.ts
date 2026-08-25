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
