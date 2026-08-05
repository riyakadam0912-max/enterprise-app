'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
  type NotificationPage,
} from '@/api/notificationsApi';
import { useAuthSession } from '@/stores/auth-store';
import { clientEnv } from '@/config/env';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [page, setPage] = useState<NotificationPage['meta']>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const session = useAuthSession();
  const pageRef = useRef(page);

  const fetchNotifications = useCallback(async (query?: { page?: number; limit?: number; unreadOnly?: boolean; module?: string; type?: string; priority?: string; sortDirection?: 'asc' | 'desc' }) => {
    setLoading(true);
    setError(null);
    try {
      const [data, countData] = await Promise.all([getNotifications(query), getUnreadCount()]);
      setNotifications(data.items);
      setPage(data.meta);
      setUnreadCount(countData.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    if (!session.user?.id) return;

    const socketUrl = clientEnv.NEXT_PUBLIC_NOTIFICATION_WS_URL;
    const client = io(`${socketUrl}/notifications`, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 8000,
    });

    client.on('connect_error', () => {
      setError('Notification socket connection failed');
    });

    client.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') {
        setError('Notification socket disconnected');
      }
    });

    client.on('notification:new', (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev.filter((item) => item.id !== notification.id)]);
      setUnreadCount((count) => count + (notification.isRead ? 0 : 1));
    });

    client.on('notification:unread-count', (payload: { count: number }) => {
      setUnreadCount(payload.count);
    });

    client.on('notification:refresh', () => {
      void fetchNotifications({ page: pageRef.current.page, limit: pageRef.current.limit });
    });

    setSocket(client);

    return () => {
      client.disconnect();
      setSocket(null);
    };
  }, [fetchNotifications, session.user?.id]);

  const markRead = useCallback(async (id: number) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const remove = useCallback(async (id: number) => {
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    void fetchNotifications({ page: page.page, limit: page.limit });
  }, [fetchNotifications, page.limit, page.page]);

  return { notifications, unreadCount, loading, error, refetch: fetchNotifications, markRead, markAllRead, remove, page, socket };
}
