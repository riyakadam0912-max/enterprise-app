import type { AuditLogEntry } from '@/api/auditLogsApi';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'created', UPDATE: 'updated', DELETE: 'deleted',
  LOGIN_SUCCESS: 'signed in', LOGIN_FAILURE: 'could not sign in',
  LOGOUT: 'signed out', CUSTOM_ACTION: 'completed an action',
};
const FIELD_LABELS: Record<string, string> = {
  assignedToUserId: 'assignee', status: 'status', projectId: 'project', dueDate: 'due date', priority: 'priority',
};
const MODULE_LABELS: Record<string, string> = {
  Auth: 'account', Users: 'people', HR: 'people', Tasks: 'task', Projects: 'project', CRM: 'customer record', Accounting: 'finance record',
};

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function auditActionLabel(action: string): string { return ACTION_LABELS[action] ?? titleCase(action); }
export function auditFieldLabel(fieldName?: string | null): string { return fieldName ? FIELD_LABELS[fieldName] ?? titleCase(fieldName) : 'details'; }
export function auditModuleLabel(module: string): string { return MODULE_LABELS[module] ?? module; }
export function auditActivitySummary(log: AuditLogEntry): string {
  const field = log.action === 'UPDATE' && log.fieldName ? ` (${auditFieldLabel(log.fieldName)} changed)` : '';
  return `${auditActionLabel(log.action)} a ${auditModuleLabel(log.module)}${field}`;
}
export function auditStatusLabel(status: AuditLogEntry['status']): string { return status === 'SUCCESS' ? 'Completed' : 'Needs attention'; }
