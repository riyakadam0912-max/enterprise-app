import { api, unwrap } from './client';

export type AuditLog = { id: number; userId: number | null; userName: string | null; userRole: string | null; module: string; entityType: string; entityId: number | null; action: string; description: string | null; status: string; createdAt: string };
export type AuditLogQuery = { page?: number; limit?: number; search?: string; module?: string; action?: string; role?: string };
export type AuditLogResponse = { items: AuditLog[]; total: number; page: number; limit: number };

export async function auditLogs(query: AuditLogQuery = {}): Promise<AuditLogResponse> {
  const response = await api.get('/audit-logs', { params: query });
  return unwrap<AuditLogResponse>(response.data);
}