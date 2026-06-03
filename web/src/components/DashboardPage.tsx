'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { DashboardStats, getDashboardStats } from '@/api/dashboardApi';
import { checkIn, checkOut, getMyAttendanceSnapshot, getTodayAttendance, type MyAttendanceResponse, type TodayAttendanceResponse } from '@/api/attendanceApi';
import { getEmployee, getEmployees, type Employee } from '@/api/employeesApi';
import { getLeaveRequests, type LeaveRequest } from '@/api/leaveRequestsApi';
import { getEmployeePayslips } from '@/api/payrollApi';
import { getTasks, type Task } from '@/api/tasksApi';
import { formatInrCurrency } from '@/utils/formatCurrency';
import { useAnalyticsSummary } from '@/hooks/useAnalyticsSummary';
import { useAttendanceSummary, useTodayAttendance } from '@/hooks/useAttendance';
import { useAuthSession } from '@/stores/auth-store';
import TimesheetsReport from './dashboard/TimesheetsReport';
import DashboardChartsSkeleton from './dashboard/DashboardChartsSkeleton';
import CardSkeleton from './dashboard/CardSkeleton';

const DashboardCharts = dynamic(() => import('./dashboard/DashboardCharts'), {
  ssr: false,
  loading: () => <DashboardChartsSkeleton />,
});

type DashboardRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

type Session = {
  role: DashboardRole;
  userId: number | null;
  employeeId: number | null;
  name: string;
};

function normalizeTaskStatus(value?: string | null): TaskStatus {
  switch (value?.toUpperCase()) {
    case 'IN_PROGRESS':
    case 'SUBMITTED':
    case 'APPROVED':
    case 'REJECTED':
      return value.toUpperCase() as TaskStatus;
    case 'PENDING':
    default:
      return 'PENDING';
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(value?: string | null) {
  if (!value) return 'Pending';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function taskTitle(task: Task) {
  return task.taskName ?? 'Untitled task';
}

function taskOwner(task: Task) {
  return task.assignedToUser?.name ?? task.assignee ?? 'Unassigned';
}

function isTaskActive(task: Task) {
  const status = normalizeTaskStatus(task.status);
  return status !== 'APPROVED' && status !== 'REJECTED';
}

function sortByDueDate(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    const leftDate = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDate = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return leftDate - rightDate;
  });
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const classes: Record<string, string> = {
    PENDING: 'bg-slate-100 text-slate-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    SUBMITTED: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-rose-100 text-rose-700',
    PENDING_MANAGER: 'bg-amber-100 text-amber-700',
    PENDING_HR: 'bg-indigo-100 text-indigo-700',
    CANCELLED: 'bg-slate-100 text-slate-600',
    PRESENT: 'bg-emerald-100 text-emerald-700',
    ABSENT: 'bg-rose-100 text-rose-700',
    HALF_DAY: 'bg-amber-100 text-amber-700',
    LEAVE: 'bg-sky-100 text-sky-700',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${classes[normalized] ?? 'bg-slate-100 text-slate-700'}`}>
      {normalized.replace(/_/g, ' ')}
    </span>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Panel({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const todayAttendance = useTodayAttendance();
  const attendanceSummary = useAttendanceSummary(new Date().toISOString().slice(0, 7));
  const analyticsSummary = useAnalyticsSummary();

  const refreshAnalytics = useCallback(() => {
    void analyticsSummary.refetch();
  }, [analyticsSummary]);

  const tooltipStyle = useMemo(
    () => ({
      backgroundColor: '#1e293b',
      border: 'none',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '12px',
    }),
    [],
  );

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((err) => setStatsError(err instanceof Error ? err.message : 'Failed to load dashboard stats'));
  }, []);

  if (!stats && !statsError) {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)}
        </div>
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-4 w-56 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-96 rounded bg-slate-100" />
        </div>
        <div className="mt-6">
          <DashboardChartsSkeleton />
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'Total Employees', value: String(stats?.totalEmployees ?? 0) },
    { label: 'Total Deals', value: String(stats?.totalDeals ?? 0) },
    { label: 'Pipeline Value', value: formatInrCurrency(stats?.pipelineValue ?? 0) },
    { label: 'Revenue', value: formatInrCurrency(stats?.totalRevenue ?? 0) },
  ];

  const todayRows = todayAttendance.data?.rows ?? [];
  const summary = todayAttendance.data?.summary;

  return (
    <div className="min-h-full bg-slate-50 p-6">
      {statsError ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Could not load live stats: {statsError}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((card) => <StatCard key={card.label} label={card.label} value={card.value} />)}
      </div>

      <Panel title="Attendance Today" description="Live snapshot for the current workday.">
        <div className="grid gap-3 md:grid-cols-4">
          <StatCard label="Present" value={String(summary?.present ?? 0)} />
          <StatCard label="Absent" value={String(summary?.absent ?? 0)} />
          <StatCard label="Leave" value={String(summary?.leave ?? 0)} />
          <StatCard label="Half Day" value={String(summary?.halfDay ?? 0)} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
            <p className="text-sm font-semibold text-red-700">Late Employees</p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              {(todayRows.filter((row) => row.lateMinutes > 0).length === 0) ? <p className="text-slate-500">No late marks today.</p> : todayRows.filter((row) => row.lateMinutes > 0).slice(0, 6).map((row) => <p key={`late-${row.employeeId}`}>{row.employee.name} - {row.lateMinutes} mins</p>)}
            </div>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
            <p className="text-sm font-semibold text-indigo-700">Overtime Tracking</p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              {(todayRows.filter((row) => row.overtimeHours > 0).length === 0) ? <p className="text-slate-500">No overtime yet.</p> : todayRows.filter((row) => row.overtimeHours > 0).slice(0, 6).map((row) => <p key={`ot-${row.employeeId}`}>{row.employee.name} - +{row.overtimeHours.toFixed(2)} hrs</p>)}
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Recent Activity" description="Latest leave and expense events across the organization.">
          <div className="space-y-3">
            {(stats?.workflow?.recentActivity?.length ?? 0) === 0 ? <EmptyState title="No activity yet" description="Leave and expense events will appear here as they happen." /> : stats?.workflow?.recentActivity?.slice(0, 8).map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{activity.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(activity.at)}</p>
                  </div>
                  <StatusBadge status={activity.action} />
                </div>
                <Link href={activity.href} className="mt-2 inline-flex text-sm font-medium text-blue-600 hover:underline">Open record</Link>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Operational Summary" description="Pending leaves and expenses that need follow-up.">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Pending Manager Leaves" value={String(stats?.hr?.pendingManagerLeaves ?? 0)} />
            <StatCard label="Pending HR Leaves" value={String(stats?.hr?.pendingHrLeaves ?? 0)} />
            <StatCard label="Pending Expenses" value={String(stats?.hr?.pendingExpenses ?? 0)} />
            <StatCard label="Attendance Today" value={String(stats?.hr?.attendanceToday?.present ?? 0)} hint="Currently present" />
          </div>
        </Panel>
      </div>

      <div className="mt-6">
        {stats ? (
          <Suspense fallback={<DashboardChartsSkeleton />}>
            <DashboardCharts
              stats={stats}
              analytics={analyticsSummary.data ?? null}
              analyticsLoading={analyticsSummary.isLoading && !analyticsSummary.data}
              analyticsError={analyticsSummary.error instanceof Error ? analyticsSummary.error.message : null}
              analyticsRefreshing={analyticsSummary.isFetching}
              onRefreshAnalytics={refreshAnalytics}
              tooltipStyle={tooltipStyle}
            />
          </Suspense>
        ) : <DashboardChartsSkeleton />}
      </div>

      <div className="mt-6"><TimesheetsReport /></div>
    </div>
  );
}

function ManagerDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [statsResult, tasksResult, employeesResult, leavesResult, attendanceResult] = await Promise.allSettled([
      getDashboardStats(),
      getTasks(),
      getEmployees(),
      getLeaveRequests(),
      getTodayAttendance(),
    ]);

    let nextError: string | null = null;
    if (statsResult.status === 'fulfilled') setStats(statsResult.value); else nextError = nextError ?? 'Failed to load manager stats';
    if (tasksResult.status === 'fulfilled') setTasks(tasksResult.value); else nextError = nextError ?? 'Failed to load task list';
    if (employeesResult.status === 'fulfilled') setEmployees(employeesResult.value); else nextError = nextError ?? 'Failed to load employee list';
    if (leavesResult.status === 'fulfilled') setLeaveRequests(leavesResult.value); else nextError = nextError ?? 'Failed to load leave requests';
    if (attendanceResult.status === 'fulfilled') setTodayAttendance(attendanceResult.value); else nextError = nextError ?? 'Failed to load today attendance';

    setError(nextError);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const reviewQueue = useMemo(() => sortByDueDate(tasks).filter((task) => normalizeTaskStatus(task.status) === 'SUBMITTED').slice(0, 6), [tasks]);
  const activeTasks = useMemo(() => tasks.filter(isTaskActive).length, [tasks]);
  const activeEmployees = useMemo(() => employees.filter((employee) => (employee.status ?? 'ACTIVE').toUpperCase() !== 'INACTIVE').length, [employees]);
  const pendingLeaves = useMemo(() => leaveRequests.filter((request) => request.status === 'PENDING_MANAGER' || request.status === 'PENDING_HR').length, [leaveRequests]);
  const todayRows = todayAttendance?.rows ?? [];
  const todaySummary = todayAttendance?.summary;

  if (loading && !stats && reviewQueue.length === 0) {
    return <div className="min-h-full bg-slate-50 p-6"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)}</div></div>;
  }

  return (
    <div className="min-h-full bg-slate-50 p-6">
      {error ? <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Team" value={String(activeEmployees)} hint={`${employees.length} employee records`} />
        <StatCard label="Needs Review" value={String(reviewQueue.length)} hint={`${activeTasks} active tasks`} />
        <StatCard label="Pending Leaves" value={String(pendingLeaves)} hint="Manager / HR approvals" />
        <StatCard label="Present Today" value={String(todaySummary?.present ?? stats?.hr?.attendanceToday?.present ?? 0)} hint="Checked in now" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Needs Review" description="Tasks submitted by the team and waiting for attention." action={<Link href="/dashboard/tasks" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Open tasks</Link>}>
          <div className="space-y-3">
            {reviewQueue.length === 0 ? <EmptyState title="No tasks awaiting review" description="Submitted tasks will appear here as soon as team members send them in." /> : reviewQueue.map((task) => (
              <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{taskTitle(task)}</p>
                    <p className="mt-1 text-sm text-slate-500">{taskOwner(task)} · Due {formatDate(task.dueDate)}</p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                {task.description ? <p className="mt-3 line-clamp-2 text-sm text-slate-600">{task.description}</p> : null}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Team Today" description="Attendance snapshot, late marks, and overtime for the current day.">
          {todayAttendance ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Present" value={String(todaySummary?.present ?? 0)} />
                <StatCard label="Absent" value={String(todaySummary?.absent ?? 0)} />
                <StatCard label="Leave" value={String(todaySummary?.leave ?? 0)} />
                <StatCard label="Half Day" value={String(todaySummary?.halfDay ?? 0)} />
              </div>
              <div className="mt-5 space-y-3">
                {todayRows.slice(0, 6).map((row) => (
                  <div key={row.employeeId} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.employee.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.employee.department ?? 'No department'} · {row.employee.designation ?? 'No designation'}</p>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                      <p>Check in: {formatTime(row.checkIn)}</p>
                      <p>Check out: {formatTime(row.checkOut)}</p>
                      <p>Late: {row.lateMinutes} mins</p>
                    </div>
                  </div>
                ))}
                {todayRows.length === 0 ? <EmptyState title="No attendance data" description="Today’s attendance snapshot will appear here once records are available." /> : null}
              </div>
            </>
          ) : <EmptyState title="Attendance unavailable" description="Today’s team attendance will appear once the backend responds." />}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Recent Activity" description="Latest leave and expense events across the organization.">
          <div className="space-y-3">
            {(stats?.workflow?.recentActivity?.length ?? 0) === 0 ? <EmptyState title="No activity yet" description="Leave and expense events will appear here as they happen." /> : stats?.workflow?.recentActivity?.slice(0, 8).map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{activity.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(activity.at)}</p>
                  </div>
                  <StatusBadge status={activity.action} />
                </div>
                <Link href={activity.href} className="mt-2 inline-flex text-sm font-medium text-blue-600 hover:underline">Open record</Link>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Operational Summary" description="Pending leaves and expenses that need follow-up.">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Pending Manager Leaves" value={String(stats?.hr?.pendingManagerLeaves ?? 0)} />
            <StatCard label="Pending HR Leaves" value={String(stats?.hr?.pendingHrLeaves ?? 0)} />
            <StatCard label="Pending Expenses" value={String(stats?.hr?.pendingExpenses ?? 0)} />
            <StatCard label="Attendance Today" value={String(stats?.hr?.attendanceToday?.present ?? 0)} hint="Currently present" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function EmployeeDashboard({ session }: { session: Session }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<MyAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<'check-in' | 'check-out' | null>(null);
  const monthKey = new Date().toISOString().slice(0, 7);
  const attendanceSummary = useAttendanceSummary(monthKey, session.employeeId ?? undefined);

  const loadDashboard = useCallback(async () => {
    if (!session.employeeId) {
      setEmployee(null);
      setTasks([]);
      setAttendance(null);
      setLoading(false);
      setError('Employee profile is not linked yet.');
      return;
    }

    setLoading(true);
    setError(null);

    const [employeeResult, tasksResult, attendanceResult] = await Promise.allSettled([
      getEmployee(session.employeeId),
      getTasks(),
      getMyAttendanceSnapshot(),
    ]);

    let nextError: string | null = null;

    if (employeeResult.status === 'fulfilled') setEmployee(employeeResult.value); else nextError = nextError ?? 'Failed to load your profile';
    if (tasksResult.status === 'fulfilled') setTasks(tasksResult.value); else nextError = nextError ?? 'Failed to load your tasks';
    if (attendanceResult.status === 'fulfilled') setAttendance(attendanceResult.value); else nextError = nextError ?? 'Failed to load your attendance status';

    setError(nextError);
    setLoading(false);
  }, [session.employeeId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const myTasks = useMemo(() => sortByDueDate(tasks.filter((task) => task.assignedToUserId === session.employeeId || task.assignedToUser?.id === session.userId)), [session.employeeId, session.userId, tasks]);
  const openTasks = useMemo(() => myTasks.filter(isTaskActive).length, [myTasks]);
  const leaveBalance = employee?.leaveBalance ?? 0;
  const canCheckIn = !attendance?.checkIn;
  const canCheckOut = Boolean(attendance?.checkIn && !attendance?.checkOut);

  const handleAttendanceAction = useCallback(async (mode: 'check-in' | 'check-out') => {
    if (!session.employeeId) return;
    setActionBusy(mode);
    try {
      const payload = {
        employeeId: session.employeeId,
        date: new Date().toISOString().slice(0, 10),
        timestamp: new Date().toISOString(),
      };
      if (mode === 'check-in') await checkIn(payload);
      else await checkOut(payload);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update attendance right now.');
    } finally {
      setActionBusy(null);
    }
  }, [loadDashboard, session.employeeId]);

  if (loading && !employee && myTasks.length === 0) {
    return <div className="min-h-full bg-slate-50 p-6"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <CardSkeleton key={index} />)}</div></div>;
  }

  const quickActions = [
    { title: 'Tasks', href: '/dashboard/tasks', description: 'Review your assigned work.' },
    { title: 'Attendance', href: '/dashboard/attendance', description: 'Check in and track time.' },
    { title: 'Leave', href: '/dashboard/leave', description: 'Apply for time off.' },
    { title: 'Payslips', href: '/dashboard/payslips', description: 'View salary slips.' },
    { title: 'Profile', href: '/dashboard/profile', description: 'Update personal details.' },
  ];

  return (
    <div className="min-h-full bg-slate-50 p-6">
      {error ? <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Open Tasks" value={String(openTasks)} hint="Assigned to you" />
        <StatCard label="Attendance" value={attendance?.status ? attendance.status.replace(/_/g, ' ') : 'Not marked'} hint={attendance?.checkIn ? `Check in at ${formatTime(attendance.checkIn)}` : 'No check-in yet'} />
        <StatCard label="Leave Balance" value={String(leaveBalance)} hint="Remaining paid leave days" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="My Tasks Today" description="Your current work queue, sorted by due date.">
          <div className="space-y-3">
            {myTasks.length === 0 ? <EmptyState title="No assigned tasks yet" description="Assigned tasks will show up here once your manager assigns them." /> : myTasks.slice(0, 6).map((task) => (
              <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{taskTitle(task)}</p>
                    <p className="mt-1 text-sm text-slate-500">Due {formatDate(task.dueDate)} · {task.priority ?? 'LOW'} priority</p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                {task.description ? <p className="mt-3 line-clamp-2 text-sm text-slate-600">{task.description}</p> : null}
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Attendance Toggle" description="Use this card to check in or check out quickly.">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Check In</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{formatTime(attendance?.checkIn ?? null)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Check Out</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{formatTime(attendance?.checkOut ?? null)}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {canCheckIn ? <button onClick={() => void handleAttendanceAction('check-in')} disabled={Boolean(actionBusy)} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">{actionBusy === 'check-in' ? 'Checking in...' : 'Check In'}</button> : null}
                {canCheckOut ? <button onClick={() => void handleAttendanceAction('check-out')} disabled={Boolean(actionBusy)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50">{actionBusy === 'check-out' ? 'Checking out...' : 'Check Out'}</button> : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                Shift: {attendance?.shiftDetails ? `${attendance.shiftDetails.startTime ?? '--'} - ${attendance.shiftDetails.endTime ?? '--'} (${attendance.shiftDetails.type})` : 'Unassigned'}
              </div>
            </div>
          </Panel>

          <Panel title="Quick Actions" description="Jump straight into the employee pages you need most.">
            <div className="grid gap-3 sm:grid-cols-2">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
                  <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{action.description}</p>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Monthly Attendance" description="Your running attendance summary for the current month.">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label="Working Days" value={String(attendanceSummary.data?.totalWorkingDays ?? 0)} />
              <StatCard label="Present Days" value={String(attendanceSummary.data?.presentDays ?? 0)} />
              <StatCard label="Late Count" value={String(attendanceSummary.data?.lateCount ?? 0)} />
              <StatCard label="Overtime" value={`${attendanceSummary.data?.overtimeHours ?? 0} hrs`} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const auth = useAuthSession();
  const session: Session = {
    role: auth.role,
    userId: auth.user?.id ?? null,
    employeeId: auth.employeeId,
    name: auth.user?.name ?? 'User',
  };

  if (session.role === 'EMPLOYEE') return <EmployeeDashboard session={session} />;
  if (session.role === 'MANAGER') return <ManagerDashboard />;
  return <AdminDashboard />;
}