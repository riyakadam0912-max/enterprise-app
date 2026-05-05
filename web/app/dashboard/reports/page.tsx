'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { formatDate } from '@/utils/dateUtils';
import { getEmployees, Employee } from '@/api/employeesApi';
import { createEvent } from '@/api/eventsApi';
import { createNotification } from '@/api/notificationsApi';
import {
  getReportsDashboard,
  PerformerRecord,
  ReportsDashboard,
  ReportsFilters,
} from '@/api/reportsApi';

const AttendanceTrendChart = dynamic(() => import('@/components/reports/AttendanceTrendChart'), {
  ssr: false,
  loading: () => <div className="h-70 animate-pulse rounded-xl bg-cyan-50" />,
});

const PayrollCostChart = dynamic(() => import('@/components/reports/PayrollCostChart'), {
  ssr: false,
  loading: () => <div className="h-70 animate-pulse rounded-xl bg-rose-50" />,
});

const EmployeeGrowthChart = dynamic(() => import('@/components/reports/EmployeeGrowthChart'), {
  ssr: false,
  loading: () => <div className="h-70 animate-pulse rounded-xl bg-emerald-50" />,
});

const PerformanceDistributionChart = dynamic(
  () => import('@/components/reports/PerformanceDistributionChart'),
  {
    ssr: false,
    loading: () => <div className="h-70 animate-pulse rounded-xl bg-amber-50" />,
  },
);

type UserRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

function toMonthInputValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatINR(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [role] = useState<UserRole>(() => {
    if (typeof window === 'undefined') return 'ADMIN';
    const storedRole = localStorage.getItem('role');
    if (storedRole === 'EMPLOYEE' || storedRole === 'MANAGER' || storedRole === 'HR') {
      return storedRole;
    }
    return 'ADMIN';
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [data, setData] = useState<ReportsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(toMonthInputValue());
  const [department, setDepartment] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [selectedPerformer, setSelectedPerformer] = useState<PerformerRecord | null>(null);
  const [resolvedEmployeeId, setResolvedEmployeeId] = useState<number | null>(null);
  const [isResolvingEmployee, setIsResolvingEmployee] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmittingQuickAction, setIsSubmittingQuickAction] = useState(false);
  const [reviewScheduleAt, setReviewScheduleAt] = useState('');
  const [reviewLocation, setReviewLocation] = useState('HR Cabin - Review Desk');
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    if (role === 'ADMIN' || role === 'HR' || role === 'MANAGER') {
      getEmployees().then(setEmployees).catch(() => setEmployees([]));
    }
  }, [role]);

  const departments = useMemo(() => {
    const items = new Set(
      employees.map((item) => item.department).filter((item): item is string => Boolean(item)),
    );
    return Array.from(items).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (!department) return employees;
    return employees.filter((item) => item.department === department);
  }, [employees, department]);

  const filters: ReportsFilters = useMemo(() => {
    return {
      month,
      department: department || undefined,
      employeeId: selectedEmployeeId ? Number(selectedEmployeeId) : undefined,
      role: selectedRole ? (selectedRole as UserRole) : undefined,
      page: 1,
      limit: 10,
    };
  }, [month, department, selectedEmployeeId, selectedRole]);

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (active) {
        setLoading(true);
        setError(null);
      }
    });

    getReportsDashboard(filters)
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load analytics data');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters]);

  const canUseOrgFilters = role === 'ADMIN' || role === 'HR' || role === 'MANAGER';
  const canFilterRole = role === 'ADMIN' || role === 'HR';
  const canSeeTalentTables = role === 'ADMIN' || role === 'HR' || role === 'MANAGER';

  const currentUserId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const currentUser = localStorage.getItem('currentUser');
      if (!currentUser) return null;
      const parsed = JSON.parse(currentUser) as { id?: number };
      return typeof parsed.id === 'number' ? parsed.id : null;
    } catch {
      return null;
    }
  }, []);

  const closeQuickAction = () => {
    setQuickActionOpen(false);
    setSelectedPerformer(null);
    setResolvedEmployeeId(null);
    setIsResolvingEmployee(false);
    setIsSubmittingQuickAction(false);
    setActionError(null);
    setActionSuccess(null);
    setReviewScheduleAt('');
    setReviewLocation('HR Cabin - Review Desk');
    setReviewNotes('');
  };

  const openLowPerformanceQuickAction = async (performer: PerformerRecord) => {
    setQuickActionOpen(true);
    setSelectedPerformer(performer);
    setActionError(null);
    setActionSuccess(null);
    setResolvedEmployeeId(null);
    setIsResolvingEmployee(true);

    try {
      let employeeId = performer.employeeId;

      if (!employeeId) {
        const employeeList = employees.length ? employees : await getEmployees();
        const matchedEmployee = employeeList.find(
          (employee) =>
            employee.name.trim().toLowerCase() === performer.name.trim().toLowerCase() &&
            (employee.department ?? 'Unassigned') === performer.department,
        );
        employeeId = matchedEmployee?.id ?? 0;
      }

      if (!employeeId) {
        throw new Error('Could not resolve employee ID for this alert.');
      }

      setResolvedEmployeeId(employeeId);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to resolve employee ID');
    } finally {
      setIsResolvingEmployee(false);
    }
  };

  const submitQuickAction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!selectedPerformer || !resolvedEmployeeId) {
      setActionError('Employee information is not ready yet.');
      return;
    }

    if (!reviewScheduleAt) {
      setActionError('Please select review date and time.');
      return;
    }

    if (!currentUserId) {
      setActionError('Could not identify the current user for notification. Please re-login.');
      return;
    }

    setIsSubmittingQuickAction(true);

    try {
      const start = new Date(reviewScheduleAt);
      const end = new Date(start.getTime() + 45 * 60 * 1000);

      await createEvent({
        eventName: `Performance Review - ${selectedPerformer.name}`,
        eventCode: `PR-${resolvedEmployeeId}-${Date.now()}`,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        location: reviewLocation,
        organizer: 'Reports Analytics Quick Action',
        status: 'SCHEDULED',
        capacity: 2,
        description:
          `Scheduled from Low Performance alert for ${selectedPerformer.name} (${selectedPerformer.department}). ` +
          `Current rating: ${selectedPerformer.rating.toFixed(2)}. Notes: ${reviewNotes || 'No notes provided.'}`,
        eventType: 'Workshop',
      });

      await createNotification({
        userId: currentUserId,
        title: `Performance Review Scheduled: ${selectedPerformer.name}`,
        message:
          `Review scheduled for Employee ID ${resolvedEmployeeId} on ${start.toLocaleString()}. ` +
          `${reviewNotes ? `Notes: ${reviewNotes}` : 'No additional notes.'}`,
      });

      setActionSuccess('Performance review scheduled successfully. Event and notification created.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to schedule performance review');
    } finally {
      setIsSubmittingQuickAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-cyan-50 to-emerald-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-cyan-100 bg-white/85 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Insights Hub</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">Reports & Analytics</h1>
              <p className="mt-1 text-sm text-slate-600">
                Real-time and historical HR analytics inspired by Keka-style decision dashboards.
              </p>
            </div>

            <div className="grid w-full gap-3 md:w-auto md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-medium text-slate-700">
                Month
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>

              {canUseOrgFilters ? (
                <label className="text-xs font-medium text-slate-700">
                  Department
                  <select
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value);
                      setSelectedEmployeeId('');
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">All Departments</option>
                    {departments.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {canUseOrgFilters ? (
                <label className="text-xs font-medium text-slate-700">
                  Employee
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">All Employees</option>
                    {filteredEmployees.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {canFilterRole ? (
                <label className="text-xs font-medium text-slate-700">
                  Role
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">All Roles</option>
                    <option value="ADMIN">Admin</option>
                    <option value="HR">HR</option>
                    <option value="MANAGER">Manager</option>
                    <option value="EMPLOYEE">Employee</option>
                  </select>
                </label>
              ) : null}
            </div>
          </div>
        </section>

        {loading ? <SkeletonGrid /> : null}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {!loading && !error && data ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Total Employees" value={String(data.summaryCards.totalEmployees)} />
              <MetricCard label="Present Today" value={String(data.summaryCards.presentToday)} />
              <MetricCard
                label="Monthly Payroll Cost"
                value={formatINR(data.summaryCards.monthlyPayrollCost)}
              />
              <MetricCard
                label="Attrition Rate"
                value={`${data.summaryCards.attritionRate.toFixed(2)}%`}
                note={`${data.turnoverSummary.resignations} resignations this period`}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Attendance Trend</h2>
                <p className="mb-2 text-xs text-slate-500">Present vs absent by day</p>
                <AttendanceTrendChart data={data.charts.attendanceTrend} />
              </article>

              <article className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Payroll Cost Trend</h2>
                <p className="mb-2 text-xs text-slate-500">Net pay and deductions by month</p>
                <PayrollCostChart data={data.charts.payrollCost} />
              </article>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Employee Growth</h2>
                <p className="mb-2 text-xs text-slate-500">Headcount movement over recent months</p>
                <EmployeeGrowthChart data={data.charts.employeeGrowth} />
              </article>

              <article className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Performance Distribution</h2>
                <p className="mb-2 text-xs text-slate-500">Rating buckets with counts and percentages</p>
                <PerformanceDistributionChart data={data.charts.performanceDistribution} />

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  {(() => {
                    const total = data.charts.performanceDistribution.reduce((sum, item) => sum + item.count, 0) || 1;
                    return data.charts.performanceDistribution.map((item) => (
                      <div key={item.bucket} className="rounded-lg bg-slate-50 px-2 py-1">
                        {item.bucket}: {item.count} ({((item.count / total) * 100).toFixed(0)}%)
                      </div>
                    ));
                  })()}
                </div>
              </article>
            </section>

            {canSeeTalentTables ? (
              <section className="grid gap-4 lg:grid-cols-2">
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">Top Performers</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-2">Employee</th>
                        <th className="px-4 py-2">Department</th>
                        <th className="px-4 py-2">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tables.topPerformers.map((item) => (
                        <tr key={item.employeeId} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-800">{item.name}</td>
                          <td className="px-4 py-2 text-slate-600">{item.department}</td>
                          <td className="px-4 py-2 font-medium text-emerald-700">{item.rating.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>

                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">Recent Hires</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Department</th>
                        <th className="px-4 py-2">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tables.recentHires.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-800">{item.name}</td>
                          <td className="px-4 py-2 text-slate-600">{item.department ?? '-'}</td>
                          <td className="px-4 py-2 text-slate-600">
                            {item.hireDate ? formatDate(new Date(item.hireDate)) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>

                <article className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm">
                  <div className="border-b border-rose-200 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">Low Performance Alerts</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-rose-50 text-left text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-4 py-2">Employee</th>
                        <th className="px-4 py-2">Department</th>
                        <th className="px-4 py-2">Rating</th>
                        <th className="px-4 py-2">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.performanceSummary.lowPerformers.map((item) => (
                        <tr key={item.employeeId} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-800">{item.name}</td>
                          <td className="px-4 py-2 text-slate-600">{item.department}</td>
                          <td className="px-4 py-2 font-medium text-rose-700">{item.rating.toFixed(2)}</td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => openLowPerformanceQuickAction(item)}
                              className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              Low Performance
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </section>
            ) : null}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Attendance Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-220 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Employee</th>
                      <th className="px-4 py-2">Department</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Late</th>
                      <th className="px-4 py-2">Overtime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tables.attendanceBreakdown.map((item, idx) => (
                      <tr key={`${item.date}-${item.employeeId ?? idx}`} className="border-t border-slate-100">
                        <td className="px-4 py-2 text-slate-700">{formatDate(new Date(item.date))}</td>
                        <td className="px-4 py-2 text-slate-800">{item.employeeName}</td>
                        <td className="px-4 py-2 text-slate-600">{item.department}</td>
                        <td className="px-4 py-2 text-slate-700">{item.status}</td>
                        <td className="px-4 py-2 text-slate-700">{item.lateMinutes} mins</td>
                        <td className="px-4 py-2 text-slate-700">{item.overtimeHours.toFixed(2)} hrs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>

      {quickActionOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close quick action"
            className="absolute inset-0 bg-slate-900/45"
            onClick={closeQuickAction}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Quick Action</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Schedule Performance Review</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Create a review event and dispatch a notification from the low performance alert.
                </p>
              </div>
              <button
                type="button"
                onClick={closeQuickAction}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p><span className="font-semibold text-slate-700">Employee:</span> {selectedPerformer?.name ?? '-'}</p>
              <p className="mt-1"><span className="font-semibold text-slate-700">Department:</span> {selectedPerformer?.department ?? '-'}</p>
              <p className="mt-1"><span className="font-semibold text-slate-700">Current Rating:</span> {selectedPerformer ? selectedPerformer.rating.toFixed(2) : '-'}</p>
              <p className="mt-1"><span className="font-semibold text-slate-700">Employee ID:</span> {isResolvingEmployee ? 'Resolving...' : resolvedEmployeeId ?? 'Not found'}</p>
            </div>

            <form onSubmit={submitQuickAction} className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Review Date & Time
                <input
                  type="datetime-local"
                  value={reviewScheduleAt}
                  onChange={(e) => setReviewScheduleAt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  required
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Location
                <input
                  type="text"
                  value={reviewLocation}
                  onChange={(e) => setReviewLocation(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  placeholder="Meeting room or virtual link"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Review Notes
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  placeholder="Include context and expected outcomes"
                />
              </label>

              {actionError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
              ) : null}
              {actionSuccess ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{actionSuccess}</p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeQuickAction}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickAction || isResolvingEmployee || !resolvedEmployeeId}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingQuickAction ? 'Scheduling...' : 'Schedule a Performance Review'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
