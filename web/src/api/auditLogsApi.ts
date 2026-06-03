import { apiClient } from './apiClient';

export type AuditLogStatus = 'SUCCESS' | 'FAILURE';

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  module: string;
  entityType: string;
  entityId: number | null;
  action: string;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  description: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  requestMethod: string | null;
  endpoint: string | null;
  status: AuditLogStatus;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  module?: string;
  entityType?: string;
  entityId?: number;
  userId?: number;
  action?: string;
  role?: string;
  search?: string;
  from?: string;
  to?: string;
}

function buildQueryString(filters: AuditLogFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
  return apiClient<AuditLogPage>(`/audit-logs${buildQueryString(filters)}`);
}

export async function getAuditLog(id: number): Promise<AuditLogEntry> {
  return apiClient<AuditLogEntry>(`/audit-logs/${id}`);
}

export async function getAuditLogsByUser(userId: number, filters: Omit<AuditLogFilters, 'userId'> = {}): Promise<AuditLogPage> {
  return apiClient<AuditLogPage>(`/audit-logs/user/${userId}${buildQueryString(filters)}`);
}

export async function getAuditLogsByModule(module: string, filters: Omit<AuditLogFilters, 'module'> = {}): Promise<AuditLogPage> {
  return apiClient<AuditLogPage>(`/audit-logs/module/${encodeURIComponent(module)}${buildQueryString(filters)}`);
}
