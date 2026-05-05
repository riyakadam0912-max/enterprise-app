import { apiClient } from './apiClient';
import type { Lead } from '@/types/entities';
import type { Activity } from './activitiesApi';
import type { Task } from './tasksApi';

export type { Lead };

export interface CreateLeadPayload {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: string;
  source?: string;
  notes?: string;
  leadOwner?: string;
  contactedDate?: string;
  nextFollowUp?: string;
  assignedTo?: string;
  leadScore?: number;
  createdBy?: string;
}

export type UpdateLeadPayload = Partial<CreateLeadPayload>;

export interface LeadDetail {
  lead: Lead;
  activities: Activity[];
  tasks: Task[];
}

export interface ConvertLeadResponse {
  message: string;
  dealId: number;
  contactId: number;
}

export function getLeads(): Promise<Lead[]> {
  return apiClient<Lead[]>('/leads');
}

export function getLead(id: number): Promise<Lead> {
  return apiClient<Lead>(`/leads/${id}`);
}

export function getLeadDetail(id: number): Promise<LeadDetail> {
  return apiClient<LeadDetail>(`/leads/${id}/detail`);
}

export function getLeadsByStatus(): Promise<Record<string, Lead[]>> {
  return apiClient<Record<string, Lead[]>>('/leads/by-status');
}

export function createLead(data: CreateLeadPayload): Promise<Lead> {
  return apiClient<Lead>('/leads', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateLead(id: number, data: UpdateLeadPayload): Promise<Lead> {
  return apiClient<Lead>(`/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteLead(id: number): Promise<void> {
  return apiClient<void>(`/leads/${id}`, { method: 'DELETE' });
}

export function convertLead(id: number): Promise<ConvertLeadResponse> {
  return apiClient<ConvertLeadResponse>(`/leads/${id}/convert`, {
    method: 'POST',
  });
}

