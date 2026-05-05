import { apiClient } from './apiClient';

export interface Notification {
  id:        number;
  userId:    number;
  title:     string;
  message:   string;
  isRead:    boolean;
  createdAt: string;
}

export interface UnreadCount { count: number }
export interface CreateNotificationPayload {
  userId: number;
  title: string;
  message: string;
}

export function getNotifications(): Promise<Notification[]>       { return apiClient<Notification[]>('/notifications'); }
export function getUnreadCount(): Promise<UnreadCount>            { return apiClient<UnreadCount>('/notifications/unread-count'); }
export function markNotificationRead(id: number): Promise<Notification> { return apiClient<Notification>(`/notifications/${id}/read`, { method: 'PATCH' }); }
export function markAllNotificationsRead(): Promise<{ count: number }> { return apiClient<{ count: number }>('/notifications/read-all', { method: 'PATCH' }); }
export function createNotification(payload: CreateNotificationPayload): Promise<Notification> {
  return apiClient<Notification>('/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
