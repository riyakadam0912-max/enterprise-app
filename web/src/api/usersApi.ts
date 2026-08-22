import { apiClient } from './apiClient';

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  employeeId: number | null;
  managerId: number | null;
  manager: {
    id: number;
    name: string | null;
  } | null;
  createdAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: string;
  employeeId?: number | null;
  managerId?: number | null;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  employeeId?: number | null;
  managerId?: number | null;
  organizationId?: number | null;
  isActive?: boolean;
}

export async function listUsers(): Promise<UserRecord[]> {
  return apiClient<UserRecord[]>('/users');
}

export async function createUser(payload: CreateUserPayload): Promise<UserRecord> {
  return apiClient<UserRecord>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<UserRecord> {
  return apiClient<UserRecord>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateUserRole(id: number, role: string): Promise<UserRecord> {
  return apiClient<UserRecord>(`/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function activateUser(id: number): Promise<UserRecord> {
  return apiClient<UserRecord>(`/users/${id}/activate`, {
    method: 'PATCH',
  });
}

export async function deactivateUser(id: number): Promise<UserRecord> {
  return apiClient<UserRecord>(`/users/${id}/deactivate`, {
    method: 'PATCH',
  });
}

export async function deleteUser(id: number): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(`/users/${id}`, {
    method: 'DELETE',
  });
}
