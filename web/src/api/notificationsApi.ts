import { apiClient } from './apiClient';

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  module?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  actionUrl?: string | null;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  readAt?: string | null;
  deliveredAt?: string | null;
}

export interface NotificationPage {
  items: Notification[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface UnreadCount { count: number }
export interface CreateNotificationPayload {
  userId?: number;
  recipientIds?: number[];
  type?: string;
  title: string;
  message: string;
  module?: string;
  entityType?: string;
  entityId?: number;
  actionUrl?: string;
  priority?: string;
  category?: string;
}

export interface NotificationPreferences {
  userId: number;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  mentionNotifications: boolean;
  approvalNotifications: boolean;
  reminderNotifications: boolean;
  criticalBypassMute: boolean;
}

export function getNotifications(params?: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  module?: string;
  type?: string;
  priority?: string;
  sortDirection?: 'asc' | 'desc';
}): Promise<NotificationPage> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.unreadOnly !== undefined) searchParams.set('unreadOnly', String(params.unreadOnly));
  if (params?.module) searchParams.set('module', params.module);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.priority) searchParams.set('priority', params.priority);
  if (params?.sortDirection) searchParams.set('sortDirection', params.sortDirection);

  const query = searchParams.toString();
  return apiClient<NotificationPage>(query ? `/notifications?${query}` : '/notifications');
}

export function getUnreadCount(): Promise<UnreadCount> { return apiClient<UnreadCount>('/notifications/unread-count'); }
export function markNotificationRead(id: number): Promise<Notification> { return apiClient<Notification>(`/notifications/read/${id}`, { method: 'POST' }); }
export function markAllNotificationsRead(): Promise<{ count: number }> { return apiClient<{ count: number }>('/notifications/read-all', { method: 'POST' }); }
export function deleteNotification(id: number): Promise<{ deleted: boolean }> { return apiClient<{ deleted: boolean }>(`/notifications/${id}`, { method: 'DELETE' }); }
export function getNotificationPreferences(): Promise<NotificationPreferences> { return apiClient<NotificationPreferences>('/notifications/preferences'); }
export function updateNotificationPreferences(payload: Partial<Omit<NotificationPreferences, 'userId'>>): Promise<NotificationPreferences> {
  return apiClient<NotificationPreferences>('/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
export function createNotification(payload: CreateNotificationPayload): Promise<Notification> {
  return apiClient<Notification>('/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
