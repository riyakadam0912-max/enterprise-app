import { api, unwrap } from './client';
import type { LeaveApplication, LeaveBalance, LeaveRecord } from '@/src/types/hr';
export type LeaveRequest = LeaveRecord & { id: number; status?: string; leaveType?: string; startDate?: string; endDate?: string; reason?: string; employee?: { name?: string | null } | null };
export async function leaveHistory(): Promise<LeaveRecord[]> { const payload = unwrap<unknown>((await api.get('/ess/leave/history')).data); return Array.isArray(payload) ? payload as LeaveRecord[] : []; }
export async function leaveBalance(): Promise<LeaveBalance> { return unwrap<LeaveBalance>((await api.get('/ess/leave/balance')).data); }
export async function applyLeave(data: LeaveApplication) { return unwrap<LeaveRecord>((await api.post('/ess/leave/apply', data)).data); }
export async function leaveRequests(): Promise<LeaveRequest[]> { const payload = unwrap<unknown>((await api.get('/leave-requests')).data); return Array.isArray(payload) ? payload as LeaveRequest[] : []; }
export async function approveLeave(id: number, stage: 'manager' | 'hr') { return unwrap<LeaveRequest>((await api.patch(`/leave-requests/${id}/${stage}-approve`)).data); }
export async function rejectLeave(id: number, reason: string) { return unwrap<LeaveRequest>((await api.patch(`/leave-requests/${id}/reject`, { reason })).data); }
export async function leaveRequest(id: number): Promise<LeaveRequest> { return unwrap<LeaveRequest>((await api.get(`/leave-requests/${id}`)).data); }
export async function updateLeaveRequest(id: number, data: Partial<Pick<LeaveRequest, 'leaveType' | 'startDate' | 'endDate' | 'reason'>>) { return unwrap<LeaveRequest>((await api.patch(`/leave-requests/${id}`, data)).data); }
export async function removeLeaveRequest(id: number) { return unwrap<LeaveRequest>((await api.delete(`/leave-requests/${id}`)).data); }
