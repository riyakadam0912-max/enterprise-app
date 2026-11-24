import { apiClient } from './apiClient';

export interface PlatformSettings {
  general: { platformName: string; supportEmail: string; defaultTimezone: string; defaultCurrency: string; defaultLocale: string };
  security: { minimumPasswordLength: number; sessionTimeoutMinutes: number; requireTwoFactor: boolean };
  notifications: { emailEnabled: boolean; smsEnabled: boolean; criticalAlertsEnabled: boolean };
  features: { maintenanceMode: boolean; allowOrganizationSignup: boolean };
  updatedAt: string | null;
}

export interface PlatformCapabilities {
  deployment: { mode: string; environment: string };
  email: { configured: boolean; provider: string };
  storage: { configured: boolean; provider: string };
  redis: { configured: boolean };
  queues: { enabled: boolean };
  websockets: { enabled: boolean; reason: string | null };
}

export interface PlatformSettingsHistoryItem {
  id: number; createdAt: string; userName?: string | null; description?: string | null; status: string;
}

export const getPlatformSettings = () => apiClient<PlatformSettings>('/platform-settings');
export const updatePlatformSettings = (settings: Omit<PlatformSettings, 'updatedAt'>) => apiClient<PlatformSettings>('/platform-settings', { method: 'PATCH', body: JSON.stringify(settings) });
export const getPlatformCapabilities = () => apiClient<PlatformCapabilities>('/platform-settings/capabilities');
export const getPlatformSettingsHistory = () => apiClient<PlatformSettingsHistoryItem[]>('/platform-settings/history');
