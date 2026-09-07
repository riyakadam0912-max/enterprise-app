import { api, unwrap } from './client';
export type Organization = { id: number; name: string; code: string; slug: string; status: string; logoUrl?: string | null };
export type PlatformStats = {
	organizations: { total: number; newThisMonth: number; active: number; healthy: number };
	users: { total: number; active: number };
	security: { recentEvents: number; requireReview: number };
};
export async function listOrganizations() { return unwrap<Organization[]>((await api.get('/organizations')).data); }
export async function organization(id: number) { return unwrap<Organization>((await api.get(`/organizations/${id}`)).data); }
export async function platformStats() { return unwrap<PlatformStats>((await api.get('/organizations/platform-stats')).data); }
export type OrganizationInput = { name: string; slug?: string; businessEmail?: string; phone?: string; industry?: string; adminName?: string; adminEmail?: string; adminPassword?: string };
export async function createOrganization(payload: OrganizationInput) { return unwrap<Organization>((await api.post('/organizations', payload)).data); }
export async function updateOrganization(id: number, payload: Partial<OrganizationInput> & { status?: string }) { return unwrap<Organization>((await api.patch(`/organizations/${id}`, payload)).data); }
export async function deleteOrganization(id: number) { return unwrap<unknown>((await api.delete(`/organizations/${id}`)).data); }
export async function setOrganizationStatus(id: number, status: 'ACTIVE' | 'SUSPENDED') { return unwrap<Organization>((await api.patch(`/organizations/${id}/${status === 'ACTIVE' ? 'activate' : 'suspend'}`)).data); }
