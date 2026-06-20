'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { assignShift, AttendanceRecord, AttendanceStatus, createShift, getShifts, ShiftRecord } from '@/api/attendanceApi';
import { useAttendance, useCheckIn, useCheckOut, useTodayAttendance, useUpdateAttendance } from '@/hooks/useAttendance';
import { useEmployees } from '@/hooks/useEmployees';
import TableActions from '@/components/common/TableActions';
import { reportError } from '@/lib/error-handling';

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ABSENT: 'bg-red-50 text-red-700 border-red-200',
  LEAVE: 'bg-sky-50 text-sky-700 border-sky-200',
  HALF_DAY: 'bg-amber-50 text-amber-700 border-amber-200',
};

type SessionUser = {
  role: 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';
  employeeId: number | null;
  name: string;
};

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getSessionUser(): SessionUser {
  if (typeof window === 'undefined') {
    return { role: 'ADMIN', employeeId: null, name: 'User' };
  }

  const storedRole = localStorage.getItem('role');
  const role =
    storedRole === 'EMPLOYEE' || storedRole === 'HR' || storedRole === 'MANAGER'
      ? storedRole
      : 'ADMIN';
  const employeeIdRaw = localStorage.getItem('employeeId');
  const rawUser = localStorage.getItem('currentUser');

  let name = 'User';
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser) as { name?: string };
      name = parsed.name ?? 'User';
    } catch {
      name = 'User';
    }
  }

  return {
    role,
    employeeId: employeeIdRaw ? Number(employeeIdRaw) : null,
    name,
  };
}

function formatTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatShiftRange(row: AttendanceRecord) {
  const details = row.shiftDetails;
  if (!details) return 'Unassigned';
  if (!details.startTime || !details.endTime) return `${details.name} (${details.type})`;
  return `${details.startTime} - ${details.endTime}`;
}

function formatDateInput(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatTimeInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toIsoFromParts(date: string, time: string) {
  if (!date || !time) return undefined;
  return new Date(`${date}T${time}:00`).toISOString();
}

function StatCard({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${tone}`}>{icon}</span>
        <span className="text-3xl font-semibold text-slate-900">{value}</span>
      </div>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {status === 'HALF_DAY' ? 'Half Day' : status.replace('_', ' ')}
    </span>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-2xl text-orange-500 shadow-sm">
        ○
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function EmployeeAttendancePanel(props: {
  name: string;
  employeeId: number | null;
  accountLinked: boolean;
  helperError: string | null;
  row: AttendanceRecord | null;
  checkInLoading: boolean;
  checkOutLoading: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  const { name, employeeId, accountLinked, helperError, row, checkInLoading, checkOutLoading, onCheckIn, onCheckOut } = props;
  const hasCheckedIn = Boolean(row?.checkIn);
  const hasCheckedOut = Boolean(row?.checkOut);

  return (
    <div className="rounded-3xl border border-slate-200 bg-linear-to-br from-orange-50 via-white to-amber-50 p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Self Attendance</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Mark your attendance, {name}</h2>
          <p className="mt-2 text-sm text-slate-600">
            Use these actions to record your own workday. Your check-in and check-out are saved immediately.
          </p>
        </div>

        <div className="grid min-w-[18rem] gap-3 sm:grid-cols-2 lg:w-md">
          <button
            onClick={onCheckIn}
            disabled={!accountLinked || hasCheckedIn || checkInLoading}
            className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkInLoading ? 'Checking In…' : hasCheckedIn ? 'Already Checked In' : 'Mark Check In'}
          </button>
          <button
            onClick={onCheckOut}
            disabled={!accountLinked || !hasCheckedIn || hasCheckedOut || checkOutLoading}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkOutLoading ? 'Checking Out…' : hasCheckedOut ? 'Already Checked Out' : 'Mark Check Out'}
          </button>
        </div>
      </div>

      {!accountLinked ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your login is not linked to an employee profile yet. An admin needs to assign this user to an employee before you can mark attendance.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-white/80 px-4 py-3 border border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{new Date().toLocaleDateString()}</p>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3 border border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{row?.status ? row.status.replace('_', ' ') : 'Not Marked'}</p>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3 border border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Check In</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{formatTime(row?.checkIn ?? null)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3 border border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Check Out</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{formatTime(row?.checkOut ?? null)}</p>
          </div>
        </div>
      )}

      {accountLinked && helperError && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {helperError}
        </div>
      )}

      {employeeId && (
        <div className="mt-4 flex justify-start">
          <Link href={`/dashboard/attendance/employee/${employeeId}`} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            View Monthly Attendance
          </Link>
        </div>
      )}
    </div>
  );
}

function SearchableEmployeeSelect(props: {
  employees: Array<{ id: number; name: string; email?: string | null }>;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  allowAll?: boolean;
}) {
  const { employees, value, onChange, placeholder, allowAll = false } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filteredEmployees = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) return employees;
    return employees.filter((employee) => `${employee.name} ${employee.email ?? ''}`.toLowerCase().includes(normalized));
  }, [deferredQuery, employees]);

  const selectedEmployee = employees.find((employee) => String(employee.id) === value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-left text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        <span className={selectedEmployee ? 'text-slate-900' : 'text-slate-400'}>
          {selectedEmployee?.name ?? placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search employee"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            {allowAll && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setQuery('');
                }}
                className="mb-1 w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                All employees
              </button>
            )}

            {filteredEmployees.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">No matching employees</p>
            ) : (
              filteredEmployees.map((employee) => (
                <button
                  type="button"
                  key={employee.id}
                  onClick={() => {
                    onChange(String(employee.id));
                    setOpen(false);
                    setQuery('');
                  }}
                  className="mb-1 w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                >
                  <p className="text-sm font-medium text-slate-900">{employee.name}</p>
                  {employee.email && <p className="text-xs text-slate-400">{employee.email}</p>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceActionModal(props: {
  mode: 'in' | 'out' | null;
  employees: Array<{ id: number; name: string; email?: string | null }>;
  employeeId: string;
  onEmployeeChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}) {
  const { mode, employees, employeeId, onEmployeeChange, onClose, onSubmit, loading, error } = props;
  if (!mode) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{mode === 'in' ? 'Check In Employee' : 'Check Out Employee'}</h2>
            <p className="text-xs text-slate-500 mt-1">Select the employee whose attendance you want to update.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Employee</label>
            <SearchableEmployeeSelect employees={employees} value={employeeId} onChange={onEmployeeChange} placeholder="Select employee" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={onSubmit} disabled={loading || !employeeId} className="px-4 py-2 rounded-lg bg-orange-500 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
            {loading ? 'Saving…' : mode === 'in' ? 'Check In' : 'Check Out'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditAttendanceModal(props: {
  record: AttendanceRecord | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: { date: string; checkIn: string; checkOut: string; status: AttendanceStatus }) => void;
}) {
  const { record, loading, error, onClose, onSubmit } = props;
  const [date, setDate] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('PRESENT');

  useEffect(() => {
    if (!record) return;
    setDate(formatDateInput(record.date));
    setCheckIn(formatTimeInput(record.checkIn));
    setCheckOut(formatTimeInput(record.checkOut));
    setStatus(record.status);
  }, [record]);

  if (!record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Edit Attendance</h2>
            <p className="text-xs text-slate-500 mt-1">Update check-in, check-out, and status for this record.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2">
          <div className="md:col-span-2 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">{record.employee.name}</p>
            <p className="text-xs text-slate-500 mt-1">{record.employee.designation ?? record.employee.department ?? 'Employee'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select value={status} onChange={(event) => setStatus(event.target.value as AttendanceStatus)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="LEAVE">Leave</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Check In</label>
            <input type="time" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Check Out</label>
            <input type="time" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>

          {error && <p className="md:col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={() => onSubmit({ date, checkIn, checkOut, status })} disabled={loading} className="px-4 py-2 rounded-lg bg-orange-500 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const searchParams = useSearchParams();
  const [session] = useState<SessionUser>(() => getSessionUser());
  const isAdmin = session.role !== 'EMPLOYEE';
  const canManageShifts = session.role === 'ADMIN' || session.role === 'HR';
  const initialPage = Number(searchParams.get('page')) || 1;
  const initialLimit = Number(searchParams.get('limit')) || 10;
  const [page, setPage] = useState(initialPage);
  const [limit] = useState(initialLimit);
  const [employeeId, setEmployeeId] = useState(searchParams.get('employeeId') || '');
  const [department, setDepartment] = useState(searchParams.get('department') || '');
  const [date, setDate] = useState(searchParams.get('date') || todayString());
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [actionMode, setActionMode] = useState<'in' | 'out' | null>(null);
  const [actionEmployeeId, setActionEmployeeId] = useState('');
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [newShift, setNewShift] = useState({
    name: '',
    type: 'FIXED' as 'FIXED' | 'FLEXIBLE' | 'ROTATIONAL',
    startTime: '09:00',
    endTime: '18:00',
    requiredHours: '8',
    gracePeriodMinutes: '15',
  });
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignShiftId, setAssignShiftId] = useState('');
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [shiftSuccess, setShiftSuccess] = useState<string | null>(null);
  const { employees } = useEmployees(isAdmin);
  const { data, loading, error, refetch } = useAttendance(
    {
      page,
      limit,
      employeeId: isAdmin && employeeId ? Number(employeeId) : undefined,
      department: isAdmin && department ? department : undefined,
      date,
      status: status ? (status as AttendanceStatus) : undefined,
    },
    isAdmin ? 'all' : 'me',
  );
  const today = useTodayAttendance();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();
  const updateAttendanceMutation = useUpdateAttendance();

  useEffect(() => {
    async function loadShifts() {
      try {
        setShifts(await getShifts());
      } catch (error) {
        reportError(error, 'Unable to load shifts');
        setShifts([]);
      }
    }

    loadShifts();
  }, []);

  useEffect(() => {
    if (!actionMode) return;
    setActionEmployeeId(employeeId || '');
    checkInMutation.setError(null);
    checkOutMutation.setError(null);
  }, [actionMode, employeeId, checkInMutation, checkOutMutation]);

  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ id: employee.id, name: employee.name, email: employee.email ?? null })),
    [employees],
  );

  const myTodayRow = useMemo(() => {
    if (isAdmin) return null;
    return today.data?.rows[0] ?? null;
  }, [isAdmin, today.data]);
  const resolvedEmployeeId = myTodayRow?.employeeId ?? session.employeeId;
  const accountLinked = isAdmin || Boolean(resolvedEmployeeId) || today.error !== 'Your login is not linked to an employee profile yet.';

  const alreadyCheckedIn = Boolean(myTodayRow?.checkIn);
  const alreadyCheckedOut = Boolean(myTodayRow?.checkOut);

  async function handleActionSubmit() {
    try {
      if (actionMode === 'in') {
        await checkInMutation.mutate(actionEmployeeId ? { employeeId: Number(actionEmployeeId) } : {});
      }

      if (actionMode === 'out') {
        await checkOutMutation.mutate(actionEmployeeId ? { employeeId: Number(actionEmployeeId) } : {});
      }

      await Promise.all([refetch(), today.refetch()]);
      setActionMode(null);
    } catch {
      // Errors are mapped in the hooks and shown in the UI.
    }
  }

  async function handleEmployeeAction(mode: 'in' | 'out') {
    try {
      if (mode === 'in') {
        await checkInMutation.mutate({});
      } else {
        await checkOutMutation.mutate({});
      }

      await Promise.all([refetch(), today.refetch()]);
    } catch {
      // Errors are mapped in the hooks and shown in the UI.
    }
  }

  async function handleAttendanceUpdate(payload: { date: string; checkIn: string; checkOut: string; status: AttendanceStatus }) {
    if (!editingRecord?.id) return;

    try {
      await updateAttendanceMutation.mutate(editingRecord.id, {
        date: payload.date,
        checkIn: payload.checkIn ? toIsoFromParts(payload.date, payload.checkIn) : undefined,
        checkOut: payload.checkOut ? toIsoFromParts(payload.date, payload.checkOut) : undefined,
        status: payload.status,
      });
      await Promise.all([refetch(), today.refetch()]);
      setEditingRecord(null);
    } catch {
      // Errors are mapped in the hooks and shown in the UI.
    }
  }

  function handleResetFilters() {
    setEmployeeId('');
    setDepartment('');
    setDate(todayString());
    setStatus('');
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.limit ?? limit)));
  const attendanceRows = data?.data ?? [];
  const showEmptyState = !loading && ((attendanceRows.length === 0) || Boolean(error));

  async function handleCreateShift() {
    try {
      setShiftError(null);
      setShiftSuccess(null);
      await createShift({
        name: newShift.name,
        type: newShift.type,
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        requiredHours: Number(newShift.requiredHours) || 8,
        gracePeriodMinutes: Number(newShift.gracePeriodMinutes) || 15,
      });
      const rows = await getShifts();
      setShifts(rows);
      setShiftSuccess('Shift created successfully.');
      setNewShift((prev) => ({ ...prev, name: '' }));
    } catch (err) {
      setShiftError(err instanceof Error ? err.message : 'Unable to create shift.');
    }
  }

  async function handleAssignShift() {
    try {
      setShiftError(null);
      setShiftSuccess(null);
      await assignShift(Number(assignEmployeeId), Number(assignShiftId));
      await Promise.all([refetch(), today.refetch()]);
      setShiftSuccess('Shift assigned successfully.');
    } catch (err) {
      setShiftError(err instanceof Error ? err.message : 'Unable to assign shift.');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{isAdmin ? 'Employee Attendance' : 'My Attendance'}</h1>
          <p className="text-sm text-slate-500 mt-1">Track daily presence and working hours.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <TableActions moduleKey="attendance" rows={attendanceRows} onRefresh={refetch} />
          {isAdmin ? (
            <>
              <button onClick={() => setActionMode('in')} className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium shadow-sm hover:bg-orange-600">
                Check In
              </button>
              <button onClick={() => setActionMode('out')} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium shadow-sm hover:bg-slate-50">
                Check Out
              </button>
            </>
          ) : null}
        </div>
      </div>

      {!isAdmin && (
        <EmployeeAttendancePanel
          name={session.name}
          employeeId={resolvedEmployeeId}
          accountLinked={accountLinked}
          helperError={today.error === 'Your login is not linked to an employee profile yet.' ? null : today.error}
          row={myTodayRow}
          checkInLoading={checkInMutation.loading}
          checkOutLoading={checkOutMutation.loading}
          onCheckIn={() => handleEmployeeAction('in')}
          onCheckOut={() => handleEmployeeAction('out')}
        />
      )}

      {!isAdmin && (checkInMutation.error || checkOutMutation.error) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {checkInMutation.error || checkOutMutation.error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Present Today" value={today.data?.summary.present ?? 0} tone="bg-emerald-100 text-emerald-700" icon="✓" />
        <StatCard label="Absent" value={today.data?.summary.absent ?? 0} tone="bg-red-100 text-red-700" icon="×" />
        <StatCard label="On Leave" value={today.data?.summary.leave ?? 0} tone="bg-sky-100 text-sky-700" icon="☼" />
        <StatCard label="Half Day" value={today.data?.summary.halfDay ?? 0} tone="bg-amber-100 text-amber-700" icon="◐" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Late Count" value={today.data?.summary.lateCount ?? 0} tone="bg-yellow-100 text-yellow-700" icon="!" />
        <StatCard label="Overtime (hrs)" value={Number(today.data?.summary.overtimeHours ?? 0)} tone="bg-indigo-100 text-indigo-700" icon="+" />
      </div>

      {canManageShifts && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Shift Management</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <label className="space-y-1">
              <span className="sr-only">Shift name</span>
              <input
                id="new-shift-name"
                name="new-shift-name"
                value={newShift.name}
                onChange={(e) => setNewShift((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Shift name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="sr-only">Shift type</span>
              <select
                id="new-shift-type"
                name="new-shift-type"
                value={newShift.type}
                onChange={(e) => setNewShift((prev) => ({ ...prev, type: e.target.value as 'FIXED' | 'FLEXIBLE' | 'ROTATIONAL' }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="FIXED">Fixed</option>
                <option value="FLEXIBLE">Flexible</option>
                <option value="ROTATIONAL">Rotational</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="sr-only">Start time</span>
              <input
                id="new-shift-start"
                name="new-shift-start"
                type="time"
                value={newShift.startTime}
                onChange={(e) => setNewShift((prev) => ({ ...prev, startTime: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="sr-only">End time</span>
              <input
                id="new-shift-end"
                name="new-shift-end"
                type="time"
                value={newShift.endTime}
                onChange={(e) => setNewShift((prev) => ({ ...prev, endTime: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="sr-only">Required hours</span>
              <input
                id="new-shift-hours"
                name="new-shift-hours"
                type="number"
                value={newShift.requiredHours}
                onChange={(e) => setNewShift((prev) => ({ ...prev, requiredHours: e.target.value }))}
                placeholder="Hours"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>
            <button onClick={handleCreateShift} className="rounded-xl bg-orange-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">Create Shift</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="sr-only">Select employee</span>
              <select
                id="assign-shift-employee"
                name="assign-shift-employee"
                value={assignEmployeeId}
                onChange={(e) => setAssignEmployeeId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">Select employee</option>
                {employeeOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="sr-only">Select shift</span>
              <select
                id="assign-shift-shift"
                name="assign-shift-shift"
                value={assignShiftId}
                onChange={(e) => setAssignShiftId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">Select shift</option>
                {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} ({shift.type})</option>)}
              </select>
            </label>
            <button onClick={handleAssignShift} disabled={!assignEmployeeId || !assignShiftId} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Assign Shift</button>
          </div>

          {shiftError && <p id="shift-error" className="text-sm text-red-600">{shiftError}</p>}
          {shiftSuccess && <p className="text-sm text-emerald-600">{shiftSuccess}</p>}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className={`grid grid-cols-1 gap-3 ${isAdmin ? 'md:grid-cols-5' : 'md:grid-cols-3'}`}>
          {isAdmin && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Employee</label>
              <SearchableEmployeeSelect
                employees={employeeOptions}
                value={employeeId}
                onChange={(value) => {
                  setEmployeeId(value);
                  setPage(1);
                }}
                placeholder="All employees"
                allowAll
              />
            </div>
          )}

          {isAdmin && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Department</label>
              <input
                value={department}
                onChange={(event) => {
                  setDepartment(event.target.value);
                  setPage(1);
                }}
                placeholder="Filter by department"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Status</label>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LEAVE">Leave</option>
              <option value="HALF_DAY">Half Day</option>
            </select>
          </div>

          <div className="flex items-end">
            <button onClick={handleResetFilters} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="max-h-128 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                {isAdmin && <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>}
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Check In</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Check Out</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Working Hours</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Shift</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Late</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Overtime</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                {isAdmin && <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 8} className="px-5 py-12 text-center text-slate-400">Loading attendance…</td>
                </tr>
              ) : showEmptyState ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 8} className="p-0">
                    <EmptyState title="No attendance records found" description="Try changing date or filters." />
                  </td>
                </tr>
              ) : data?.data.map((row) => (
                <tr key={`${row.employeeId}-${row.date}`} className="hover:bg-slate-50 transition-colors">
                  {isAdmin && (
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/attendance/employee/${row.employeeId}`} className="font-medium text-slate-900 hover:text-orange-600">
                        {row.employee.name}
                      </Link>
                      <p className="text-xs text-slate-400 mt-1">{row.employee.designation ?? row.employee.department ?? 'Employee'}</p>
                    </td>
                  )}
                  <td className="px-5 py-4 text-slate-600">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="px-5 py-4 text-slate-600">{formatTime(row.checkIn)}</td>
                  <td className="px-5 py-4 text-slate-600">{formatTime(row.checkOut)}</td>
                  <td className="px-5 py-4 text-slate-700">{row.workingHours != null ? `${row.workingHours.toFixed(2)} hrs` : '—'}</td>
                  <td className="px-5 py-4 text-slate-700">{formatShiftRange(row)}</td>
                  <td className="px-5 py-4">
                    {row.lateMinutes > 0 ? (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Late by {row.lateMinutes} mins</span>
                    ) : (
                      <span className="text-slate-400">On time</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-700">{row.overtimeHours > 0 ? `+${row.overtimeHours.toFixed(2)} hrs` : '—'}</td>
                  <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                  {isAdmin && (
                    <td className="px-5 py-4 text-right">
                      {row.id ? (
                        <button
                          onClick={() => {
                            updateAttendanceMutation.setError(null);
                            setEditingRecord(row);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {data?.page ?? page} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {isAdmin && (
        <AttendanceActionModal
          mode={actionMode}
          employees={employeeOptions}
          employeeId={actionEmployeeId}
          onEmployeeChange={setActionEmployeeId}
          onClose={() => setActionMode(null)}
          onSubmit={handleActionSubmit}
          loading={checkInMutation.loading || checkOutMutation.loading}
          error={checkInMutation.error || checkOutMutation.error}
        />
      )}

      {isAdmin && (
        <EditAttendanceModal
          record={editingRecord}
          loading={updateAttendanceMutation.loading}
          error={updateAttendanceMutation.error}
          onClose={() => setEditingRecord(null)}
          onSubmit={handleAttendanceUpdate}
        />
      )}
    </div>
  );
}