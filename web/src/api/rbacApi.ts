import { apiClient } from './apiClient';

export interface PermissionRecord {
  id: number;
  key: string;
  description: string | null;
}

export interface RoleRecord {
  id: number;
  name: string;
  description: string | null;
  rolePermissions: Array<{
    permission: PermissionRecord;
  }>;
}

export async function listRoles(): Promise<RoleRecord[]> {
  return apiClient<RoleRecord[]>('/rbac/roles');
}

export async function createRole(name: string, description?: string): Promise<RoleRecord> {
  return apiClient<RoleRecord>('/rbac/roles', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function updateRole(id: number, name?: string, description?: string): Promise<RoleRecord> {
  return apiClient<RoleRecord>(`/rbac/roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description }),
  });
}

export async function deleteRole(id: number): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(`/rbac/roles/${id}`, {
    method: 'DELETE',
  });
}

export async function listPermissions(): Promise<PermissionRecord[]> {
  return apiClient<PermissionRecord[]>('/rbac/permissions');
}

export async function assignPermissionToRole(roleId: number, permissionKey: string): Promise<unknown> {
  return apiClient<unknown>(`/rbac/roles/${roleId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ permissionKey }),
  });
}

export async function removePermissionFromRole(roleId: number, permissionKey: string): Promise<unknown> {
  return apiClient<unknown>(`/rbac/roles/${roleId}/permissions`, {
    method: 'DELETE',
    body: JSON.stringify({ permissionKey }),
  });
}
