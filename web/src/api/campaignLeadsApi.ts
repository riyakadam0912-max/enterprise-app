import { apiClient } from './apiClient';

export interface CampaignLeadRow {
  id: number;
  campaign: string;
  engagementScore: number | null;
  sourceType: string | null;
  lastInteraction: string | null;
  status: string;
  notes: string | null;
  leadId: number | null;
  lead: { id: number; name: string } | null;
}

export interface CreateCampaignLeadPayload {
  campaign: string;
  leadId?: number;
  engagementScore?: number;
  sourceType?: string;
  lastInteraction?: string;
  status?: string;
  notes?: string;
}

export function getCampaignLeads(): Promise<CampaignLeadRow[]> {
  return apiClient<CampaignLeadRow[]>('/campaign-leads');
}

export function createCampaignLead(payload: CreateCampaignLeadPayload): Promise<CampaignLeadRow> {
  return apiClient<CampaignLeadRow>('/campaign-leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteCampaignLead(id: number): Promise<void> {
  return apiClient<void>(`/campaign-leads/${id}`, { method: 'DELETE' });
}
