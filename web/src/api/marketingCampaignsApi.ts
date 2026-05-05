import { apiClient } from './apiClient';

export type CampaignStatus = 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface MarketingCampaign {
  id: number;
  campaignName: string;
  channel: string | null;
  startDate: string | null;
  endDate: string | null;
  objective: string | null;
  budget: number | null;
  status: string;
  targetAudience: string | null;
  createdBy: string | null;
  campaignOwner: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMarketingCampaignPayload {
  campaignName: string;
  channel?: string;
  startDate?: string;
  endDate?: string;
  objective?: string;
  budget?: number;
  status?: string;
  targetAudience?: string;
  createdBy?: string;
  campaignOwner?: string;
}

export async function getMarketingCampaigns(): Promise<MarketingCampaign[]> {
  return apiClient<MarketingCampaign[]>('/marketing-campaigns');
}

export async function getMarketingCampaign(id: number): Promise<MarketingCampaign> {
  return apiClient<MarketingCampaign>(`/marketing-campaigns/${id}`);
}

export async function createMarketingCampaign(payload: CreateMarketingCampaignPayload): Promise<MarketingCampaign> {
  return apiClient<MarketingCampaign>('/marketing-campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateMarketingCampaign(id: number, payload: Partial<CreateMarketingCampaignPayload>): Promise<MarketingCampaign> {
  return apiClient<MarketingCampaign>(`/marketing-campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteMarketingCampaign(id: number): Promise<void> {
  await apiClient<void>(`/marketing-campaigns/${id}`, { method: 'DELETE' });
}

export async function getMarketingCampaignsByChannel(): Promise<Record<string, MarketingCampaign[]>> {
  return apiClient<Record<string, MarketingCampaign[]>>('/marketing-campaigns/by-channel');
}
