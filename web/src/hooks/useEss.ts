import { useState, useCallback } from 'react';
import * as essApi from '../api/essApi';

type CheckInData = essApi.CheckInResponse;
type CheckOutData = essApi.CheckOutResponse;
type ApplyLeaveInput = Parameters<typeof essApi.applyLeave>[0];
type SubmitExpenseInput = Parameters<typeof essApi.submitExpense>[0];
type UpdateProfileInput = Parameters<typeof essApi.updateMyProfile>[0];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
};

// Attendance Hooks
export function useCheckIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckInData | null>(null);

  const checkIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.checkIn();
      setData(result);
      return result;
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { checkIn, loading, error, data };
}

export function useCheckOut() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckOutData | null>(null);

  const checkOut = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.checkOut();
      setData(result);
      return result;
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { checkOut, loading, error, data };
}

export function useAttendanceToday() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<essApi.AttendanceStatus | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.getAttendanceToday();
      setData(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount
  const [fetched, setFetched] = useState(false);
  if (!fetched) {
    fetch();
    setFetched(true);
  }

  return { data, loading, error, refetch: fetch };
}

export function useAttendanceHistory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<essApi.AttendanceRecord[]>([]);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.getAttendanceHistory();
      setData(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const [fetched, setFetched] = useState(false);
  if (!fetched) {
    fetch();
    setFetched(true);
  }

  return { data, loading, error, refetch: fetch };
}

// Leave Hooks
export function useApplyLeave() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(async (data: ApplyLeaveInput) => {
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.applyLeave(data);
      return result;
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { apply, loading, error };
}

export function useLeaveBalance() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<essApi.LeaveBalance | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.getLeaveBalance();
      setData(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const [fetched, setFetched] = useState(false);
  if (!fetched) {
    fetch();
    setFetched(true);
  }

  return { data, loading, error, refetch: fetch };
}

export function useLeaveHistory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<essApi.LeaveRecord[]>([]);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.getLeaveHistory();
      setData(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const [fetched, setFetched] = useState(false);
  if (!fetched) {
    fetch();
    setFetched(true);
  }

  return { data, loading, error, refetch: fetch };
}

// Payslip Hooks
export function useMyPayslips() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<essApi.PayslipSummary[]>([]);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.getMyPayslips();
      setData(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const [fetched, setFetched] = useState(false);
  if (!fetched) {
    fetch();
    setFetched(true);
  }

  return { data, loading, error, refetch: fetch };
}

export function usePayslipDetails(payslipId: number | null) {
  const [loading, setLoading] = useState(!!payslipId);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<essApi.PayslipDetails | null>(null);

  const fetch = useCallback(async () => {
    if (!payslipId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.getPayslipDetails(payslipId);
      setData(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [payslipId]);

  const [fetched, setFetched] = useState(false);
  if (!fetched && payslipId) {
    fetch();
    setFetched(true);
  }

  return { data, loading, error, refetch: fetch };
}

// Expense Hooks
export function useSubmitExpense() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (data: SubmitExpenseInput) => {
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.submitExpense(data);
      return result;
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit, loading, error };
}

export function useMyExpenses() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<essApi.ExpenseRecord[]>([]);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.getMyExpenses();
      setData(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const [fetched, setFetched] = useState(false);
  if (!fetched) {
    fetch();
    setFetched(true);
  }

  return { data, loading, error, refetch: fetch };
}

// Profile Hooks
export function useMyProfile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<essApi.EmployeeProfile | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.getMyProfile();
      setData(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const [fetched, setFetched] = useState(false);
  if (!fetched) {
    fetch();
    setFetched(true);
  }

  return { data, loading, error, refetch: fetch };
}

export function useUpdateProfile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (data: UpdateProfileInput) => {
    setLoading(true);
    setError(null);
    try {
      const result = await essApi.updateMyProfile(data);
      return result;
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { update, loading, error };
}
