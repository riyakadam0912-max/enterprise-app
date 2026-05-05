'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,
  Notification,
} from '@/api/notificationsApi';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [data, countData] = await Promise.all([getNotifications(), getUnreadCount()]);
      setNotifications(data);
      setUnreadCount(countData.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = useCallback(async (id: number) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, loading, error, refetch: fetchNotifications, markRead, markAllRead };
}
