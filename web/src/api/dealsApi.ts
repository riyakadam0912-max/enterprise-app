import { apiClient } from './apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DealStage = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';
export type DealScope = 'mine' | 'my_team' | 'unassigned';

export interface Deal {
  id:              number;
  ownerUserId:     number | null;
  title:           string;
  value:           number;
  stage:           DealStage;
  probability:     number | null;
  closeDate:       string | null;
  actualCloseDate: string | null;
  contact:         string | null;
  owner:           string | null;
  pipeline:        string | null;
  leadId:          number | null;
  employeeId:      number | null;
  contactId:       number | null;
  lead:            { id: number; name: string; company: string | null } | null;
  employee:        { id: number; fullName: string; position: string | null } | null;
  linkedContact:   { id: number; contactName: string; company: string | null } | null;
  createdAt:       string;
  updatedAt:       string;
}

export type Pipeline = Record<Lowercase<DealStage>, Deal[]>;

export interface CreateDealPayload {
  title:            string;
  value:            number;
  stage?:           DealStage;
  probability?:     number;
  closeDate?:       string;
  actualCloseDate?: string;
  contact?:         string;
  owner?:           string;
  pipeline?:        string;
  leadId?:          number;
  employeeId?:      number;
  contactId?:       number;
}

export type UpdateDealPayload = Partial<CreateDealPayload>;

// ── API functions ─────────────────────────────────────────────────────────────

export function getDeals(scope?: DealScope): Promise<Deal[]> {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  return apiClient<Deal[]>(`/deals${query}`);
}

export function getDeal(id: number): Promise<Deal> {
  return apiClient<Deal>(`/deals/${id}`);
}

export function createDeal(data: CreateDealPayload): Promise<Deal> {
  return apiClient<Deal>('/deals', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

export function updateDeal(id: number, data: UpdateDealPayload): Promise<Deal> {
  return apiClient<Deal>(`/deals/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(data),
  });
}

export function deleteDeal(id: number): Promise<void> {
  return apiClient<void>(`/deals/${id}`, { method: 'DELETE' });
}

export function getPipeline(): Promise<Pipeline> {
  return apiClient<Pipeline>('/deals/pipeline');
}

export function reassignDealOwner(id: number, ownerUserId: number | null): Promise<Deal> {
  return apiClient<Deal>(`/deals/${id}/owner`, {
    method: 'PATCH',
    body: JSON.stringify({ ownerUserId }),
  });
}
