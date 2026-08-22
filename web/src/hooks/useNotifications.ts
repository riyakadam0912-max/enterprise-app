'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  deleteNotification,
  getNotifications,
  getNotificationCounts,
  getNotificationsLive,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
  type NotificationPage,
} from '@/api/notificationsApi';
import { useAuthSession } from '@/stores/auth-store';
import { clientEnv } from '@/config/env';

type TransportMode = 'socket' | 'polling' | 'idle';

export function useNotifications(options?: {
  enablePolling?: boolean;
  pollingIntervalMs?: number;
  activePollingIntervalMs?: number;
  isActive?: boolean;
}) {
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
  const [transportMode, setTransportMode] = useState<TransportMode>('idle');

  const session = useAuthSession();
  const pageRef = useRef(page);
  const lastSyncAtRef = useRef<string>(new Date(0).toISOString());
  const lastSeenNotificationIdRef = useRef<number | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketConnectedRef = useRef(false);
  const transportModeRef = useRef<TransportMode>('idle');
  const isActiveRef = useRef(options?.isActive ?? false);

  const enablePolling = options?.enablePolling ?? clientEnv.NEXT_PUBLIC_POLLING_ENABLED ?? true;
  const pollingInterval = options?.pollingIntervalMs ?? clientEnv.NEXT_PUBLIC_POLLING_INTERVAL_MS ?? 15000;
  const activePollingInterval = options?.activePollingIntervalMs ?? clientEnv.NEXT_PUBLIC_POLLING_INTERVAL_ACTIVE_MS ?? 3000;

  useEffect(() => {
    isActiveRef.current = options?.isActive ?? false;
  }, [options?.isActive]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    transportModeRef.current = transportMode;
  }, [transportMode]);

  const fetchNotifications = useCallback(async (query?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    module?: string;
    type?: string;
    priority?: string;
    sortDirection?: 'asc' | 'desc';
  }) => {
    setLoading(true);
    setError(null);
    try {
      const [data, countData] = await Promise.all([
        getNotifications(query),
        getUnreadCount(),
      ]);
      setNotifications(data.items);
      setPage(data.meta);
      setUnreadCount(countData.count);
      if (data.items.length > 0) {
        const latest = data.items.reduce(
          (max, it) => (it.id > max ? it.id : max),
          data.items[0].id,
        );
        lastSeenNotificationIdRef.current = latest;
      }
      lastSyncAtRef.current = new Date().toISOString();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch notifications',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const pollDelta = useCallback(async () => {
    if (transportModeRef.current === 'socket' && socketConnectedRef.current) {
      return;
    }
    try {
      const shouldUseCounts = !isActiveRef.current;
      if (shouldUseCounts) {
        const counts = await getNotificationCounts();
        setUnreadCount(counts.unreadCount);
        if (
          counts.latestNotificationId !== null &&
          (lastSeenNotificationIdRef.current === null ||
            counts.latestNotificationId > lastSeenNotificationIdRef.current)
        ) {
          const delta = await getNotificationsLive(lastSyncAtRef.current);
          if (delta.items && delta.items.length > 0) {
            setNotifications((prev) => {
              const existing = new Map(prev.map((it) => [it.id, it]));
              for (const item of delta.items) {
                existing.set(item.id, item);
              }
              return Array.from(existing.values()).sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );
            });
            const maxId = delta.items.reduce(
              (max, it) => (it.id > max ? it.id : max),
              delta.items[0].id,
            );
            lastSeenNotificationIdRef.current = Math.max(
              lastSeenNotificationIdRef.current ?? 0,
              maxId,
            );
          }
          setUnreadCount(delta.unreadCount ?? counts.unreadCount);
        }
        if (counts.syncCursor) {
          lastSyncAtRef.current = counts.syncCursor;
        }
        return;
      }

      const delta = await getNotificationsLive(lastSyncAtRef.current);
      if (delta.items && delta.items.length > 0) {
        setNotifications((prev) => {
          const existing = new Map(prev.map((it) => [it.id, it]));
          for (const item of delta.items) {
            existing.set(item.id, item);
          }
          return Array.from(existing.values()).sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        });
        const maxId = delta.items.reduce(
          (max, it) => (it.id > max ? it.id : max),
          delta.items[0].id,
        );
        lastSeenNotificationIdRef.current = Math.max(
          lastSeenNotificationIdRef.current ?? 0,
          maxId,
        );
      }
      if (typeof delta.unreadCount === 'number') {
        setUnreadCount(delta.unreadCount);
      }
      if (delta.syncCursor) {
        lastSyncAtRef.current = delta.syncCursor;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Notification polling failed',
      );
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingTimerRef.current !== null) {
      clearInterval(pollingTimerRef.current);
    }
    const interval = isActiveRef.current ? activePollingInterval : pollingInterval;
    pollingTimerRef.current = setInterval(() => {
      void pollDelta();
    }, interval);
  }, [pollDelta, pollingInterval, activePollingInterval]);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current !== null) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (
      !session.user?.id ||
      typeof window === 'undefined'
    ) {
      return;
    }

    const wsUrl = clientEnv.NEXT_PUBLIC_NOTIFICATION_WS_URL;
    const canUseSocket =
      !enablePolling ||
      (wsUrl && typeof wsUrl === 'string' && wsUrl.trim().length > 0);

    lastSyncAtRef.current = new Date().toISOString();

    if (!canUseSocket) {
      setTransportMode('polling');
      void pollDelta();
      startPolling();
      return () => {
        stopPolling();
      };
    }

    const client = io(`${wsUrl}/notifications`, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 8000,
    });

    socketConnectedRef.current = false;
    let socketFailures = 0;

    client.on('connect', () => {
      socketConnectedRef.current = true;
      socketFailures = 0;
      if (transportModeRef.current !== 'socket') {
        setTransportMode('socket');
        stopPolling();
      }
    });

    client.on('connect_error', () => {
      socketConnectedRef.current = false;
      socketFailures += 1;
      if (socketFailures >= 2 && transportModeRef.current !== 'polling') {
        setTransportMode('polling');
        void pollDelta();
        startPolling();
      }
      if (transportModeRef.current === 'socket') {
        setError('Notification socket connection failed');
      }
    });

    client.on('disconnect', (reason) => {
      socketConnectedRef.current = false;
      if (reason !== 'io client disconnect') {
        if (enablePolling && transportModeRef.current !== 'polling') {
          setTransportMode('polling');
          void pollDelta();
          startPolling();
        } else if (transportModeRef.current === 'socket') {
          setError('Notification socket disconnected');
        }
      }
    });

    client.on('notification:new', (notification: Notification) => {
      setNotifications((prev) => [
        notification,
        ...prev.filter((item) => item.id !== notification.id),
      ]);
      setUnreadCount((count) => count + (notification.isRead ? 0 : 1));
      lastSeenNotificationIdRef.current = Math.max(
        lastSeenNotificationIdRef.current ?? 0,
        notification.id,
      );
      lastSyncAtRef.current = new Date().toISOString();
    });

    client.on('notification:unread-count', (payload: { count: number }) => {
      setUnreadCount(payload.count);
    });

    client.on('notification:refresh', () => {
      void fetchNotifications({
        page: pageRef.current.page,
        limit: pageRef.current.limit,
      });
    });

    setSocket(client);
    setTransportMode('socket');

    return () => {
      client.disconnect();
      setSocket(null);
      socketConnectedRef.current = false;
      stopPolling();
      setTransportMode('idle');
    };
  }, [
    fetchNotifications,
    pollDelta,
    session.user?.id,
    enablePolling,
    startPolling,
    stopPolling,
  ]);

  const markRead = useCallback(async (id: number) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const remove = useCallback(
    async (id: number) => {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((item) => item.id !== id));
      void fetchNotifications({
        page: page.page,
        limit: page.limit,
      });
    },
    [fetchNotifications, page.limit, page.page],
  );

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refetch: fetchNotifications,
    markRead,
    markAllRead,
    remove,
    page,
    socket,
    transportMode,
    pollNow: pollDelta,
  };
}
