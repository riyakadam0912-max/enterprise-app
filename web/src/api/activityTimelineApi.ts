import { apiClient } from './apiClient';

export interface ActivityTimelineComment {
  id: number;
  timelineId: number;
  userId: number | null;
  userRole: string | null;
  comment: string;
  parentCommentId: number | null;
  mentions: unknown[] | null;
  isInternal: boolean;
  attachments: unknown[] | null;
  createdAt: string;
}

export interface ActivityTimelineItem {
  id: number;
  module: string;
  entityType: string;
  entityId: number;
  eventType: string;
  action: string;
  title: string;
  description: string | null;
  oldValue: unknown | null;
  newValue: unknown | null;
  metadata: Record<string, unknown> | null;
  performedBy: number | null;
  performedByRole: string | null;
  assignedTo: number | null;
  status: string;
  priority: string;
  icon: string | null;
  color: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  attachments: unknown[] | null;
  workflowStage: string | null;
  approvalStatus: string | null;
  createdAt: string;
  commentsCount?: number;
  comments?: ActivityTimelineComment[];
}

export interface ActivityTimelinePage {
  items: ActivityTimelineItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ActivityTimelineQuery {
  page?: number;
  limit?: number;
  search?: string;
  module?: string;
  eventType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateActivityTimelineCommentPayload {
  timelineId: number;
  parentCommentId?: number;
  userId?: number;
  userRole?: string;
  comment: string;
  mentions?: number[];
  isInternal?: boolean;
}

function buildQueryString(params: ActivityTimelineQuery = {}) {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.search) searchParams.set('search', params.search);
  if (params.module) searchParams.set('module', params.module);
  if (params.eventType) searchParams.set('eventType', params.eventType);
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
  if (params.dateTo) searchParams.set('dateTo', params.dateTo);

  return searchParams.toString();
}

export function getTimeline(params?: ActivityTimelineQuery): Promise<ActivityTimelinePage> {
  const query = buildQueryString(params);
  return apiClient<ActivityTimelinePage>(query ? `/timeline?${query}` : '/timeline');
}

export function getEntityTimeline(entityType: string, entityId: number, params?: ActivityTimelineQuery): Promise<ActivityTimelinePage> {
  const query = buildQueryString(params);
  return apiClient<ActivityTimelinePage>(query ? `/timeline/entity/${entityType}/${entityId}?${query}` : `/timeline/entity/${entityType}/${entityId}`);
}

export function getUserActivity(userId: number, params?: ActivityTimelineQuery): Promise<ActivityTimelinePage> {
  const query = buildQueryString(params);
  return apiClient<ActivityTimelinePage>(query ? `/timeline/user/${userId}?${query}` : `/timeline/user/${userId}`);
}

export function createTimelineComment(payload: CreateActivityTimelineCommentPayload): Promise<ActivityTimelineComment> {
  return apiClient<ActivityTimelineComment>('/timeline/comment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
