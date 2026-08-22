'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createTimelineComment,
  getTimeline,
  getTimelineLive,
  type ActivityTimelineItem,
  type ActivityTimelinePage,
  type ActivityTimelineQuery,
  type CreateActivityTimelineCommentPayload,
} from '@/api/activityTimelineApi';

const DEFAULT_META: ActivityTimelinePage['meta'] = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

export function useActivityTimeline(
  initialQuery: ActivityTimelineQuery = {},
  options?: {
    enablePolling?: boolean;
    pollingIntervalMs?: number;
    entityFilter?: { entityType: string; entityId: number };
  },
) {
  const [items, setItems] = useState<ActivityTimelineItem[]>([]);
  const [meta, setMeta] = useState<ActivityTimelinePage['meta']>(DEFAULT_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<ActivityTimelineQuery>({
    page: 1,
    limit: 20,
    ...initialQuery,
  });

  const lastSyncAtRef = useRef<string>(new Date(0).toISOString());
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enablePolling = options?.enablePolling ?? false;
  const pollingInterval = options?.pollingIntervalMs ?? 10000;
  const entityFilter = options?.entityFilter;

  const fetchTimeline = useCallback(
    async (nextQuery: ActivityTimelineQuery = query) => {
      setLoading(true);
      setError(null);

      try {
        const mergedQuery: ActivityTimelineQuery = { ...nextQuery };
        if (entityFilter) {
          mergedQuery.entityType = entityFilter.entityType;
          mergedQuery.entityId = entityFilter.entityId;
        }
        const response = entityFilter
          ? await (
              await import('@/api/activityTimelineApi')
            ).getEntityTimeline(
              entityFilter.entityType,
              entityFilter.entityId,
              mergedQuery,
            )
          : await getTimeline(mergedQuery);
        setItems(response.items);
        setMeta(response.meta);
        lastSyncAtRef.current = new Date().toISOString();
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Failed to load activity timeline',
        );
      } finally {
        setLoading(false);
      }
    },
    [query, entityFilter],
  );

  const pollDelta = useCallback(async () => {
    try {
      const params: ActivityTimelineQuery = {};
      if (entityFilter) {
        params.entityType = entityFilter.entityType;
        params.entityId = entityFilter.entityId;
      }
      if (query.module) params.module = query.module;
      if (query.eventType) params.eventType = query.eventType;
      const delta = await getTimelineLive(lastSyncAtRef.current, params);

      if (delta.items && delta.items.length > 0) {
        setItems((prev) => {
          const existing = new Map(prev.map((it) => [it.id, it]));
          for (const item of delta.items) {
            existing.set(item.id, item);
          }
          return Array.from(existing.values()).sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        });
      }
      if (delta.syncCursor) {
        lastSyncAtRef.current = delta.syncCursor;
      }
    } catch (pollError) {
      setError(
        pollError instanceof Error
          ? pollError.message
          : 'Timeline polling failed',
      );
    }
  }, [query.module, query.eventType, entityFilter]);

  useEffect(() => {
    void fetchTimeline(query);
  }, [fetchTimeline, query]);

  useEffect(() => {
    if (!enablePolling || typeof window === 'undefined') {
      return;
    }
    void pollDelta();
    pollingTimerRef.current = setInterval(() => {
      void pollDelta();
    }, pollingInterval);

    return () => {
      if (pollingTimerRef.current !== null) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [enablePolling, pollingInterval, pollDelta]);

  const setFilters = useCallback(
    (nextFilters: Partial<ActivityTimelineQuery>) => {
      setQuery((current) => ({ ...current, ...nextFilters, page: 1 }));
    },
    [],
  );

  const goToPage = useCallback((page: number) => {
    setQuery((current) => ({ ...current, page }));
  }, []);

  const addComment = useCallback(
    async (payload: CreateActivityTimelineCommentPayload) => {
      const created = await createTimelineComment(payload);
      setItems((current) =>
        current.map((item) => {
          if (item.id !== payload.timelineId) return item;
          const nextComments = [...(item.comments ?? []), created];
          return {
            ...item,
            comments: nextComments,
            commentsCount: nextComments.length,
          };
        }),
      );
      return created;
    },
    [],
  );

  return {
    items,
    meta,
    loading,
    error,
    query,
    setFilters,
    goToPage,
    refresh: () => void fetchTimeline(query),
    addComment,
    pollNow: pollDelta,
  };
}
