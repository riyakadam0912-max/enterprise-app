'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { assignShift, AttendanceRecord, AttendanceStatus, createShift, getMonthlyAttendanceReport, getShifts, ShiftRecord } from '@/api/attendanceApi';
import { useAttendance, useCheckIn, useCheckOut, useTodayAttendance, useUpdateAttendance } from '@/hooks/useAttendance';
import { useEmployees } from '@/hooks/useEmployees';
import TableActions from '@/components/common/TableActions';
import { reportError } from '@/lib/error-handling';
import { useAuthSession } from '@/stores/auth-store';

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ABSENT: 'bg-red-50 text-red-700 border-red-200',
  LEAVE: 'bg-sky-50 text-sky-700 border-sky-200',
  HALF_DAY: 'bg-amber-50 text-amber-700 border-amber-200',
};

type MonthlyReportStatus = AttendanceStatus | 'LATE' | '';

interface MonthlyAttendanceReportRow {
  employeeId: number;
  employeeName: string;
  department: string | null;
  role: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  leaveCount: number;
  workingDays: number;
  attendancePercent: number;
}

interface MonthlyAttendanceReportResponse {
  month: string;
  year: number;
  rows: MonthlyAttendanceReportRow[];
  total: number;
}

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

    const timeout = window.setTimeout(() => {
      setDate(formatDateInput(record.date));
      setCheckIn(formatTimeInput(record.checkIn));
      setCheckOut(formatTimeInput(record.checkOut));
      setStatus(record.status);
    }, 0);

    return () => window.clearTimeout(timeout);
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
  const authSession = useAuthSession();
  const session = {
    role: (authSession.role as 'SUPER_ADMIN' | 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE') ?? 'EMPLOYEE',
    employeeId: authSession.employeeId ?? null,
    name: authSession.user?.name ?? 'User',
  };
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
  const canViewAdminAttendance = session.role === 'SUPER_ADMIN' || session.role === 'ADMIN' || session.role === 'HR';
  const { employees } = useEmployees(canViewAdminAttendance);
  const { data, loading, error, refetch } = useAttendance(
    {
      page,
      limit,
      employeeId: canViewAdminAttendance && employeeId ? Number(employeeId) : undefined,
      department: canViewAdminAttendance && department ? department : undefined,
      date,
      status: status ? (status as AttendanceStatus) : undefined,
    },
    canViewAdminAttendance ? 'all' : 'me',
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

  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ id: employee.id, name: employee.name, email: employee.email ?? null })),
    [employees],
  );

  const myTodayRow = useMemo(() => {
    if (canViewAdminAttendance) return null;
    return today.data?.rows.find((row) => row.employeeId === session.employeeId) ?? today.data?.rows[0] ?? null;
  }, [canViewAdminAttendance, session.employeeId, today.data]);
  const resolvedEmployeeId = myTodayRow?.employeeId ?? session.employeeId;
  const accountLinked = canViewAdminAttendance || Boolean(resolvedEmployeeId) || today.error !== 'Your login is not linked to an employee profile yet.';

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

  const [monthlyReport, setMonthlyReport] = useState<MonthlyAttendanceReportResponse | null>(null);
  const [monthlyReportLoading, setMonthlyReportLoading] = useState(false);
  const [monthlyReportError, setMonthlyReportError] = useState<string | null>(null);
  const [reportMonth, setReportMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [reportEmployeeId, setReportEmployeeId] = useState('');
  const [reportDepartment, setReportDepartment] = useState('');
  const [reportStatus, setReportStatus] = useState<MonthlyReportStatus>('');

  useEffect(() => {
    if (!canViewAdminAttendance) {
      setMonthlyReport(null);
      return;
    }

    let cancelled = false;
    async function loadMonthlyReport() {
      setMonthlyReportLoading(true);
      setMonthlyReportError(null);
      try {
        const response = await getMonthlyAttendanceReport({
          month: reportMonth,
          year: reportYear,
          employeeId: reportEmployeeId ? Number(reportEmployeeId) : undefined,
          department: reportDepartment || undefined,
          status: reportStatus || undefined,
        });
        if (!cancelled) {
          setMonthlyReport(response);
        }
      } catch (err) {
        if (!cancelled) {
          setMonthlyReportError(err instanceof Error ? err.message : 'Unable to load monthly attendance report.');
          setMonthlyReport(null);
        }
      } finally {
        if (!cancelled) {
          setMonthlyReportLoading(false);
        }
      }
    }

    void loadMonthlyReport();
    return () => {
      cancelled = true;
    };
  }, [canViewAdminAttendance, reportDepartment, reportEmployeeId, reportMonth, reportStatus, reportYear]);

  function exportMonthlyReport() {
    const rows = monthlyReport?.rows ?? [];
    if (rows.length === 0) return;

    const headers = ['Employee Name', 'Employee ID', 'Department', 'Role', 'Total Present', 'Total Absent', 'Late Count', 'Half Days', 'Leaves', 'Working Days', 'Attendance %'];
    const body = rows.map((row) => [
      row.employeeName,
      row.employeeId,
      row.department ?? '',
      row.role,
      row.presentCount,
      row.absentCount,
      row.lateCount,
      row.halfDayCount,
      row.leaveCount,
      row.workingDays,
      `${row.attendancePercent}%`,
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `attendance-${monthlyReport?.month ?? 'report'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
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
          {canViewAdminAttendance ? (
            <button onClick={exportMonthlyReport} disabled={monthlyReport?.rows.length === 0} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              Export CSV
            </button>
          ) : null}
        </div>
      </div>

      {!canViewAdminAttendance && (
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

      {!canViewAdminAttendance && (checkInMutation.error || checkOutMutation.error) && (
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

      {canViewAdminAttendance && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Monthly Attendance Report</h3>
              <p className="text-sm text-slate-500">Filter and export attendance trends for the selected month.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={String(index + 1).padStart(2, '0')}>{new Date(2024, index, 1).toLocaleString([], { month: 'long' })}</option>
                ))}
              </select>
              <input type="number" min="2000" max="2100" value={reportYear} onChange={(event) => setReportYear(event.target.value)} className="w-24 rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              <select value={reportEmployeeId} onChange={(event) => setReportEmployeeId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                <option value="">All employees</option>
                {employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
              <input value={reportDepartment} onChange={(event) => setReportDepartment(event.target.value)} placeholder="Department" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              <select value={reportStatus} onChange={(event) => setReportStatus(event.target.value as MonthlyReportStatus)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                <option value="">All statuses</option>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="LATE">Late</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="LEAVE">Leave</option>
              </select>
            </div>
          </div>

          {monthlyReportLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading monthly attendance…</div>
          ) : monthlyReportError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{monthlyReportError}</div>
          ) : (
            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-240 w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Employee Name</th>
                    <th className="px-4 py-3">Employee ID</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Total Present</th>
                    <th className="px-4 py-3">Total Absent</th>
                    <th className="px-4 py-3">Late Count</th>
                    <th className="px-4 py-3">Half Days</th>
                    <th className="px-4 py-3">Leaves</th>
                    <th className="px-4 py-3">Working Days</th>
                    <th className="px-4 py-3">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {monthlyReport?.rows.length ? monthlyReport.rows.map((row) => (
                    <tr key={row.employeeId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{row.employeeName}</td>
                      <td className="px-4 py-3 text-slate-600">{row.employeeId}</td>
                      <td className="px-4 py-3 text-slate-600">{row.department ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.role}</td>
                      <td className="px-4 py-3 text-slate-600">{row.presentCount}</td>
                      <td className="px-4 py-3 text-slate-600">{row.absentCount}</td>
                      <td className="px-4 py-3 text-slate-600">{row.lateCount}</td>
                      <td className="px-4 py-3 text-slate-600">{row.halfDayCount}</td>
                      <td className="px-4 py-3 text-slate-600">{row.leaveCount}</td>
                      <td className="px-4 py-3 text-slate-600">{row.workingDays}</td>
                      <td className="px-4 py-3 text-slate-600">{row.attendancePercent}%</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-500">No monthly report rows match the current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
        <div className={`grid grid-cols-1 gap-3 ${canViewAdminAttendance ? 'md:grid-cols-5' : 'md:grid-cols-3'}`}>
          {canViewAdminAttendance && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Employee</label>
              <select
                value={employeeId}
                onChange={(event) => {
                  setEmployeeId(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">All employees</option>
                {employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </div>
          )}

          {canViewAdminAttendance && (
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
                {canViewAdminAttendance && <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>}
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Check In</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Check Out</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Working Hours</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Shift</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Late</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Overtime</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                {canViewAdminAttendance && <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={canViewAdminAttendance ? 10 : 8} className="px-5 py-12 text-center text-slate-400">Loading attendance…</td>
                </tr>
              ) : showEmptyState ? (
                <tr>
                  <td colSpan={canViewAdminAttendance ? 10 : 8} className="p-0">
                    <EmptyState title="No attendance records found" description="Try changing date or filters." />
                  </td>
                </tr>
              ) : data?.data.map((row) => (
                <tr key={`${row.employeeId}-${row.date}`} className="hover:bg-slate-50 transition-colors">
                  {canViewAdminAttendance && (
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
                  {canViewAdminAttendance && (
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

      {canViewAdminAttendance && (
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