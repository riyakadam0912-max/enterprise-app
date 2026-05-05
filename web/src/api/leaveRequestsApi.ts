import { apiClient } from './apiClient';

export type LeaveStatus = 'PENDING_MANAGER' | 'PENDING_HR' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type LeaveType = 'SICK' | 'CASUAL' | 'PAID' | 'UNPAID' | 'MATERNITY' | 'PATERNITY' | 'MEDICAL' | 'OTHER';

export interface LeaveRequest {
  id:         number;
  startDate:  string;
  endDate:    string;
  leaveType:  LeaveType;
  reason:     string | null;
  status:     LeaveStatus;
  appliedOn:  string | null;
  approvedBy: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  approvalTrail?: {
    action: 'SUBMITTED' | 'MANAGER_APPROVED' | 'HR_APPROVED' | 'REJECTED';
    at: string;
    byUserId: number;
    reason: string | null;
  }[] | null;
  employeeId: number | null;
  employee:   { id: number; name: string } | null;
  createdAt:  string;
  updatedAt:  string;
}

export interface CreateLeaveRequestPayload {
  startDate:   string;
  endDate:     string;
  leaveType:   LeaveType;
  reason?:     string;
  status?:     LeaveStatus;
  appliedOn?:  string;
  approvedBy?: string;
  employeeId?: number;
}

export type UpdateLeaveRequestPayload = Partial<CreateLeaveRequestPayload>;

export function getLeaveRequests(): Promise<LeaveRequest[]> {
  return apiClient<LeaveRequest[]>('/leave-requests');
}

export function getLeaveRequest(id: number): Promise<LeaveRequest> {
  return apiClient<LeaveRequest>(`/leave-requests/${id}`);
}

export function createLeaveRequest(data: CreateLeaveRequestPayload): Promise<LeaveRequest> {
  return apiClient<LeaveRequest>('/leave-requests', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

export function updateLeaveRequest(id: number, data: UpdateLeaveRequestPayload): Promise<LeaveRequest> {
  return apiClient<LeaveRequest>(`/leave-requests/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(data),
  });
}

export function deleteLeaveRequest(id: number): Promise<void> {
  return apiClient<void>(`/leave-requests/${id}`, { method: 'DELETE' });
}

export function managerApproveLeaveRequest(id: number): Promise<LeaveRequest> {
  return apiClient<LeaveRequest>(`/leave-requests/${id}/manager-approve`, {
    method: 'PATCH',
  });
}

export function hrApproveLeaveRequest(id: number): Promise<LeaveRequest> {
  return apiClient<LeaveRequest>(`/leave-requests/${id}/hr-approve`, {
    method: 'PATCH',
  });
}

export function rejectLeaveRequest(id: number, reason?: string): Promise<LeaveRequest> {
  return apiClient<LeaveRequest>(`/leave-requests/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}
