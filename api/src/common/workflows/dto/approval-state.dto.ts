export type ApprovalActionType =
  | 'SUBMITTED'
  | 'MANAGER_APPROVED'
  | 'HR_APPROVED'
  | 'REJECTED';

export interface ApprovalTrailEntryDto {
  action: ApprovalActionType;
  at: string;
  byUserId: number;
  reason: string | null;
}

export interface ApprovalStateDto {
  status: string;
  approvedBy: string | null;
  approvedAt: Date | string | null;
  rejectedAt: Date | string | null;
  rejectionReason: string | null;
  approvalTrail: ApprovalTrailEntryDto[];
}
