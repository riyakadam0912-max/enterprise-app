import { api, tokenStore, unwrap } from './client';
import type { AuthPayload, Session } from '@/src/types/auth';

export async function login(email: string, password: string): Promise<AuthPayload> {
  const payload = unwrap<AuthPayload>((await api.post('/auth/login', { email, password })).data);
  if (!payload.access_token || !payload.refresh_token) throw new Error('The API did not return a mobile session.');
  await tokenStore.save(payload.access_token, payload.refresh_token);
  return payload;
}
export async function currentUser() { return unwrap<Session>((await api.get('/auth/me')).data); }
export type AccountProfile = { id: number; name: string; email: string | null; phone: string | null; address: string | null; designation: string | null };
export type EmployeeProfile = { id: number; name: string; email: string | null; phone: string | null; phoneNumber: string | null; position: string | null; designation: string | null; department: string | null; hireDate: string | null; address: string | null; user?: { id?: number; role?: string; isActive?: boolean; createdAt?: string } };
export async function accountProfile() { return unwrap<AccountProfile>((await api.get('/auth/profile/me')).data); }
export async function employeeProfile() { return unwrap<EmployeeProfile>((await api.get('/employee-self-service/profile/me')).data); }
export async function updateAccountProfile(payload: { name?: string; phone?: string; address?: string; designation?: string }) { return unwrap<AccountProfile>((await api.patch('/auth/profile/me', payload)).data); }
export async function updateEmployeeProfile(payload: { phoneNumber?: string; address?: string }) { return unwrap<EmployeeProfile>((await api.put('/employee-self-service/profile/update', payload)).data); }
export async function logout() { try { await api.post('/auth/logout'); } finally { await tokenStore.clear(); } }
