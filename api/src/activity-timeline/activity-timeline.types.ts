import type { Prisma } from '@prisma/client';

export type ActivityTimelineEventType =
  | 'CREATED'
  | 'UPDATED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'STATUS_CHANGED'
  | 'COMMENTED'
  | 'MENTIONED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURNED'
  | 'ESCALATED'
  | 'REVIEWED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ATTACHMENT_ADDED'
  | 'DOCUMENT_UPDATED'
  | 'LOGIN_ACTIVITY'
  | 'WORKFLOW_EVENT'
  | 'AUDIT_EVENT';

export type ActivityTimelinePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ActivityTimelineStatus =
  | 'OPEN'
  | 'INFO'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR'
  | 'DONE';

export type ActivityTimelineRecord = {
  id: number;
  module: string;
  entityType: string;
  entityId: number;
  eventType: string;
  action: string;
  title: string;
  description: string | null;
  oldValue: Prisma.JsonValue | null;
  newValue: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  performedBy: number | null;
  performedByRole: string | null;
  assignedTo: number | null;
  status: string;
  priority: string;
  icon: string | null;
  color: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  attachments: Prisma.JsonValue | null;
  workflowStage: string | null;
  approvalStatus: string | null;
  createdAt: string;
  commentsCount?: number;
};

export type ActivityTimelineCommentRecord = {
  id: number;
  timelineId: number;
  userId: number | null;
  userRole: string | null;
  comment: string;
  parentCommentId: number | null;
  mentions: Prisma.JsonValue | null;
  isInternal: boolean;
  createdAt: string;
};

export type ActivityTimelinePayload = {
  module: string;
  entityType: string;
  entityId: number;
  eventType: ActivityTimelineEventType;
  action?: string;
  title: string;
  description?: string | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
  performedBy?: number | null;
  performedByRole?: string | null;
  assignedTo?: number | null;
  status?: ActivityTimelineStatus;
  priority?: ActivityTimelinePriority;
  icon?: string | null;
  color?: string | null;
  ipAddress?: string | null;
  deviceInfo?: string | null;
  attachments?: Prisma.InputJsonValue | null;
  workflowStage?: string | null;
  approvalStatus?: string | null;
};
