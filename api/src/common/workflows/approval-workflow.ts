import { Prisma } from '@prisma/client';
import type {
  ApprovalActionType,
  ApprovalTrailEntryDto,
} from './dto/approval-state.dto';

type ApprovalStateWrite = {
  status: string;
  approvedBy: string | null;
  approvedAt: Date | string | null;
  rejectedAt: Date | string | null;
  rejectionReason: string | null;
  approvalTrail: Prisma.InputJsonValue;
};

function normalizeTrail(trail: unknown): ApprovalTrailEntryDto[] {
  if (!Array.isArray(trail)) {
    return [];
  }

  return trail
    .filter((entry): entry is ApprovalTrailEntryDto =>
      Boolean(entry && typeof entry === 'object'),
    )
    .map((entry) => ({
      action: entry.action,
      at: entry.at,
      byUserId: entry.byUserId,
      reason: entry.reason ?? null,
    }));
}

function appendTrail(
  trail: unknown,
  action: ApprovalActionType,
  userId: number,
  reason?: string,
): ApprovalTrailEntryDto[] {
  const nextTrail = normalizeTrail(trail);
  nextTrail.push({
    action,
    at: new Date().toISOString(),
    byUserId: userId,
    reason: reason?.trim() ? reason.trim() : null,
  });
  return nextTrail;
}

export function createSubmittedApprovalState(
  userId: number,
): Pick<ApprovalStateWrite, 'approvalTrail'> {
  return {
    approvalTrail: appendTrail(
      [],
      'SUBMITTED',
      userId,
    ) as unknown as Prisma.InputJsonValue,
  };
}

export function createManagerApprovalState(
  trail: unknown,
  userId: number,
): Pick<
  ApprovalStateWrite,
  | 'status'
  | 'approvedBy'
  | 'approvedAt'
  | 'rejectedAt'
  | 'rejectionReason'
  | 'approvalTrail'
> {
  return {
    status: 'PENDING_HR',
    approvedBy: `MANAGER:${userId}`,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    approvalTrail: appendTrail(
      trail,
      'MANAGER_APPROVED',
      userId,
    ) as unknown as Prisma.InputJsonValue,
  };
}

export function createHrApprovalState(
  trail: unknown,
  userId: number,
): Pick<
  ApprovalStateWrite,
  | 'status'
  | 'approvedBy'
  | 'approvedAt'
  | 'rejectedAt'
  | 'rejectionReason'
  | 'approvalTrail'
> {
  return {
    status: 'APPROVED',
    approvedBy: `HR:${userId}`,
    approvedAt: new Date(),
    rejectedAt: null,
    rejectionReason: null,
    approvalTrail: appendTrail(
      trail,
      'HR_APPROVED',
      userId,
    ) as unknown as Prisma.InputJsonValue,
  };
}

export function createRejectionState(
  trail: unknown,
  userRole: string,
  userId: number,
  reason?: string,
): Pick<
  ApprovalStateWrite,
  | 'status'
  | 'approvedBy'
  | 'approvedAt'
  | 'rejectedAt'
  | 'rejectionReason'
  | 'approvalTrail'
> {
  return {
    status: 'REJECTED',
    approvedBy: `${userRole}:${userId} (Rejected)`,
    approvedAt: null,
    rejectedAt: new Date(),
    rejectionReason: reason?.trim() ? reason.trim() : null,
    approvalTrail: appendTrail(
      trail,
      'REJECTED',
      userId,
      reason,
    ) as unknown as Prisma.InputJsonValue,
  };
}
