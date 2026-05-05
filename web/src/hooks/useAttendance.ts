'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AttendanceActionPayload,
  AttendanceFilters,
  AttendanceListResponse,
  AttendanceMonthlySummary,
  EmployeeAttendanceResponse,
  TodayAttendanceResponse,
  checkIn,
  checkOut,
  getAttendance,
  getAttendanceSummary,
  getEmployeeAttendance,
  getMyAttendance,
  getTodayAttendance,
  updateAttendance,
  UpdateAttendancePayload,
} from '@/api/attendanceApi';

function getFriendlyLoadError(message?: string) {
  if (message?.toLowerCase().includes('not linked to a user')) {
    return 'Your login is not linked to an employee profile yet.';
  }
  if (message?.toLowerCase().includes('forbidden') || message?.toLowerCase().includes('access denied')) {
    return 'You do not have permission to view attendance.';
  }
  return 'Unable to load attendance right now.';
}

function getFriendlyActionError(message: string) {
  if (message.toLowerCase().includes('not linked to a user')) return 'Your login is not linked to an employee profile yet.';
  if (message.toLowerCase().includes('already checked in')) return 'You have already checked in for today.';
  if (message.toLowerCase().includes('already checked out')) return 'You have already checked out for today.';
  if (message.toLowerCase().includes('no check-in record')) return 'Check in first before checking out.';
  if (message.toLowerCase().includes('approved leave')) return 'Attendance cannot be marked while the employee is on approved leave.';
  return 'Attendance action could not be completed.';
}

export function useAttendance(filters: AttendanceFilters, scope: 'all' | 'me' = 'all') {
  const [data, setData] = useState<AttendanceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { date, department, employeeId, limit, page, status } = filters;

  useEffect(() => {
    let cancelled = false;
    const delay = setTimeout(fetchAttendance, 300);

    async function fetchAttendance() {
      setLoading(true);
      setError(null);
      try {
        const response = await (scope === 'me'
          ? getMyAttendance({ date, limit, page, status })
          : getAttendance({ date, department, employeeId, limit, page, status }));
        if (!cancelled) setData(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : undefined;
        if (!cancelled) setError(getFriendlyLoadError(message));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    return () => {
      clearTimeout(delay);
      cancelled = true;
    };
  }, [date, department, employeeId, limit, page, scope, status]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await (scope === 'me'
        ? getMyAttendance({ date, limit, page, status })
        : getAttendance({ date, department, employeeId, limit, page, status }));
      setData(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      setError(getFriendlyLoadError(message));
    } finally {
      setLoading(false);
    }
  }, [date, department, employeeId, limit, page, scope, status]);

  return { data, loading, error, refetch };
}

export function useTodayAttendance(date?: string) {
  const [data, setData] = useState<TodayAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTodayAttendance(date));
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      setError(getFriendlyLoadError(message));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  return { data, loading, error, refetch: fetchToday };
}

export function useEmployeeAttendance(employeeId: number, month?: string) {
  const [data, setData] = useState<EmployeeAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(employeeId));
  const [error, setError] = useState<string | null>(null);

  const fetchEmployeeAttendance = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getEmployeeAttendance(employeeId, month));
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      setError(getFriendlyLoadError(message));
    } finally {
      setLoading(false);
    }
  }, [employeeId, month]);

  useEffect(() => {
    fetchEmployeeAttendance();
  }, [fetchEmployeeAttendance]);

  return { data, loading, error, refetch: fetchEmployeeAttendance };
}

function useAttendanceAction(action: (payload: AttendanceActionPayload) => Promise<unknown>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (payload: AttendanceActionPayload) => {
    setLoading(true);
    setError(null);
    try {
      return await action(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Attendance action failed';
      setError(getFriendlyActionError(message));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [action]);

  return { mutate, loading, error, setError };
}

export function useCheckIn() {
  return useAttendanceAction(checkIn);
}

export function useCheckOut() {
  return useAttendanceAction(checkOut);
}

export function useUpdateAttendance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (attendanceId: number, payload: UpdateAttendancePayload) => {
    setLoading(true);
    setError(null);
    try {
      return await updateAttendance(attendanceId, payload);
    } catch (err) {
      setError('Attendance record could not be updated.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error, setError };
}

export function useAttendanceSummary(month?: string, employeeId?: number) {
  const [data, setData] = useState<AttendanceMonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAttendanceSummary(month, employeeId);
      setData(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      setError(getFriendlyLoadError(message));
    } finally {
      setLoading(false);
    }
  }, [employeeId, month]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { data, loading, error, refetch: fetchSummary };
}