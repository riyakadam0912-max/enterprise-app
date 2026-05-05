import { useState, useEffect, useCallback } from 'react';
import { getTimesheetsReport, TimesheetReportResponse, TimesheetFilters } from '../api/timesheetsApi';

interface UseTimesheetsReportResult {
  data: TimesheetReportResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTimesheetsReport(filters: TimesheetFilters): UseTimesheetsReportResult {
  const [data, setData] = useState<TimesheetReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTimesheetsReport(filters)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load timesheets');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refetch };
}
