import { apiClient } from './apiClient';

export type ActivityType =
  | 'CALL'
  | 'EMAIL'
  | 'MEETING'
  | 'NOTE'
  | 'STATUS_CHANGE'
  | 'DEAL_CREATED'
  | 'LEAD_CONVERTED'
  | 'QUOTE_SENT'
  | 'INVOICE_PAID'
  | 'TASK_DUE';

export interface Activity {
  id: number;
  type: ActivityType;
  description: string;
  userId: number;
  leadId: number | null;
  dealId: number | null;
  contactId: number | null;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CreateActivityPayload {
  type: ActivityType;
  description: string;
  userId: number;
  leadId?: number;
  dealId?: number;
  contactId?: number;
}

export function createActivity(data: CreateActivityPayload): Promise<Activity> {
  return apiClient<Activity>('/activities', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getLeadActivities(id: number): Promise<Activity[]> {
  return apiClient<Activity[]>(`/activities/lead/${id}`);
}

export function getDealActivities(id: number): Promise<Activity[]> {
  return apiClient<Activity[]>(`/activities/deal/${id}`);
}

export function getContactActivities(id: number): Promise<Activity[]> {
  return apiClient<Activity[]>(`/activities/contact/${id}`);
}
