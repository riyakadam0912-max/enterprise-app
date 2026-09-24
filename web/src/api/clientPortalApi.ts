import { apiClient } from './apiClient';

export interface ClientUser {
  id: number;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  contact: { id: number; contactName: string; company: string | null; email: string | null };
  user: { id: number; name: string; email: string; isActive: boolean };
  projectAccess: Array<{ project: { id: number; projectName: string; projectCode: string | null; status: string } }>;
}

export interface CreateClientUserRequest {
  contactId: number;
  email: string;
  invitationTemplate?: string;
  projectIds: number[];
}

export function getClientUsers(): Promise<ClientUser[]> {
  return apiClient<ClientUser[]>('/client-portal/users');
}

export function createClientUser(data: CreateClientUserRequest): Promise<{ id: number; email: string; status: string; expiresAt: string }> {
  return apiClient('/client-portal/users', { method: 'POST', body: JSON.stringify(data) });
}
