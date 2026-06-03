'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createTimelineComment,
  getTimeline,
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

export function useActivityTimeline(initialQuery: ActivityTimelineQuery = {}) {
  const [items, setItems] = useState<ActivityTimelineItem[]>([]);
  const [meta, setMeta] = useState<ActivityTimelinePage['meta']>(DEFAULT_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<ActivityTimelineQuery>({ page: 1, limit: 20, ...initialQuery });

  const fetchTimeline = useCallback(async (nextQuery: ActivityTimelineQuery = query) => {
    setLoading(true);
    setError(null);

    try {
      const response = await getTimeline(nextQuery);
      setItems(response.items);
      setMeta(response.meta);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load activity timeline');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void fetchTimeline(query);
  }, [fetchTimeline, query]);

  const setFilters = useCallback((nextFilters: Partial<ActivityTimelineQuery>) => {
    setQuery((current) => ({ ...current, ...nextFilters, page: 1 }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setQuery((current) => ({ ...current, page }));
  }, []);

  const addComment = useCallback(async (payload: CreateActivityTimelineCommentPayload) => {
    const created = await createTimelineComment(payload);
    setItems((current) => current.map((item) => {
      if (item.id !== payload.timelineId) return item;
      const nextComments = [...(item.comments ?? []), created];
      return {
        ...item,
        comments: nextComments,
        commentsCount: nextComments.length,
      };
    }));
    return created;
  }, []);

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
  };
}
