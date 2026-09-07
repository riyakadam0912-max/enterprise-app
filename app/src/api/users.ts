import { api, unwrap } from './client';

export type PlatformUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  employeeId: number | null;
  createdAt: string;
};

export async function listUsers() { return unwrap<PlatformUser[]>((await api.get('/users')).data); }
export type UserInput = { name: string; email: string; password?: string; role: string; organizationId?: number | null; isActive?: boolean };
export async function createUser(payload: Required<Pick<UserInput, 'name' | 'email' | 'password' | 'role'>>) { return unwrap<PlatformUser>((await api.post('/users', payload)).data); }
export async function updateUser(id: number, payload: Partial<UserInput>) { return unwrap<PlatformUser>((await api.put(`/users/${id}`, payload)).data); }
export async function deleteUser(id: number) { return unwrap<{ success: boolean; message: string }>((await api.delete(`/users/${id}`)).data); }
export async function setUserStatus(id: number, active: boolean) { return unwrap<PlatformUser>((await api.patch(`/users/${id}/${active ? 'activate' : 'deactivate'}`)).data); }