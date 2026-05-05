'use client';

import { Suspense, useEffect, useState } from 'react';
import { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getDashboardStats, DashboardStats } from '@/api/dashboardApi';
import { useAnalyticsSummary } from '@/hooks/useAnalyticsSummary';
import { useAttendanceSummary, useTodayAttendance } from '@/hooks/useAttendance';
import { formatInrCurrency } from '@/utils/formatCurrency';
import TimesheetsReport from './dashboard/TimesheetsReport';
import DashboardChartsSkeleton from './dashboard/DashboardChartsSkeleton';
import CardSkeleton from './dashboard/CardSkeleton';

const DashboardCharts = dynamic(() => import('./dashboard/DashboardCharts'), {
  ssr: false,
  loading: () => <DashboardChartsSkeleton />,
});

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [role] = useState<'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE'>(() => {
    if (typeof window === 'undefined') return 'ADMIN';
    const storedRole = localStorage.getItem('role');
    if (storedRole === 'EMPLOYEE') return 'EMPLOYEE';
    if (storedRole === 'MANAGER') return 'MANAGER';
    if (storedRole === 'HR') return 'HR';
    return 'ADMIN';
  });
  const todayAttendance = useTodayAttendance();
  const monthKey = new Date().toISOString().slice(0, 7);
  const attendanceSummary = useAttendanceSummary(monthKey);
  const analyticsSummary = useAnalyticsSummary();
  const canViewTeamAttendance =
    role === 'ADMIN' || role === 'HR' || role === 'MANAGER';
  const showChartSkeleton = !stats;
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

  const refreshAnalytics = useCallback(() => {
    void analyticsSummary.refetch();
  }, [analyticsSummary]);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((err) => setStatsError(err instanceof Error ? err.message : 'Failed to load stats'));
  }, []);

  if (!stats && !statsError) {
    return (
      <div className="bg-slate-50 min-h-full p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>

        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="h-4 w-48 rounded bg-slate-200 animate-pulse" />
              <div className="mt-2 h-3 w-80 rounded bg-slate-100 animate-pulse" />
            </div>
            <div className="h-10 w-36 rounded-lg bg-slate-200 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        </div>

        <DashboardChartsSkeleton />
      </div>
    );
  }

  const kpiCards = [
    { label: 'Total Employees', value: String(stats?.totalEmployees ?? 0) },
    { label: 'Total Deals', value: String(stats?.totalDeals ?? 0) },
    { label: 'Pipeline Value', value: formatInrCurrency(stats?.pipelineValue ?? 0) },
    { label: 'Total Revenue', value: formatInrCurrency(stats?.totalRevenue ?? 0) },
    { label: 'Absenteeism', value: `${stats?.absenteeismRate ?? 0}%` },
    { label: 'Revenue / Lead', value: formatInrCurrency(stats?.revenuePerLead ?? 0) },
    { label: 'Deal Conversion', value: `${stats?.conversionRate ?? 0}%` },
  ];

  const todayRows = todayAttendance.data?.rows ?? [];
  const todaySummary = todayAttendance.data?.summary;
  const myTodayRecord = todayRows[0];
  const lateRows = todayRows.filter((row) => row.lateMinutes > 0);
  const overtimeRows = todayRows.filter((row) => row.overtimeHours > 0);

  return (
    <div className="bg-slate-50 min-h-full p-6">

      {/* ── API error banner ── */}
      {statsError && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          Could not load live stats: {statsError}
        </div>
      )}

      {/* ═══ ROW 1 — KPI Stat Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="bg-orange-500 w-11 h-11 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-orange-500 leading-tight">{card.value}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">{canViewTeamAttendance ? 'Attendance Today' : 'My Attendance Today'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {canViewTeamAttendance
                ? 'Live attendance snapshot for the current workday.'
                : 'Your check-in status and today\'s working record.'}
            </p>
          </div>
          <Link href="/dashboard/attendance" className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
            Open Attendance
          </Link>
        </div>

        {todayAttendance.error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {todayAttendance.error}
          </div>
        ) : canViewTeamAttendance ? (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Present</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{todaySummary?.present ?? 0}</p>
            </div>
            <div className="rounded-xl bg-red-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Absent</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{todaySummary?.absent ?? 0}</p>
            </div>
            <div className="rounded-xl bg-sky-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Leave</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{todaySummary?.leave ?? 0}</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Half Day</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{todaySummary?.halfDay ?? 0}</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-orange-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Status</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{myTodayRecord?.status ? myTodayRecord.status.replace('_', ' ') : 'Not marked yet'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Check In</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {myTodayRecord?.checkIn ? new Date(myTodayRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Check Out</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {myTodayRecord?.checkOut ? new Date(myTodayRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
              </p>
            </div>
            <div className="rounded-xl bg-yellow-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">Late Today</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{myTodayRecord?.lateMinutes ? `${myTodayRecord.lateMinutes} mins` : 'No'}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Overtime Today</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{myTodayRecord?.overtimeHours ? `+${myTodayRecord.overtimeHours.toFixed(2)} hrs` : '0 hrs'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 md:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shift</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {myTodayRecord?.shiftDetails
                  ? `Shift: ${myTodayRecord.shiftDetails.startTime ?? '--'} - ${myTodayRecord.shiftDetails.endTime ?? '--'} (${myTodayRecord.shiftDetails.type})`
                  : 'Shift: Unassigned'}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Working Days</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{attendanceSummary.data?.totalWorkingDays ?? 0}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Present Days</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{attendanceSummary.data?.presentDays ?? 0}</p>
          </div>
          <div className="rounded-xl bg-red-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Absent Days</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{attendanceSummary.data?.absentDays ?? 0}</p>
          </div>
          <div className="rounded-xl bg-yellow-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">Late Count</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{attendanceSummary.data?.lateCount ?? 0}</p>
          </div>
          <div className="rounded-xl bg-indigo-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Overtime</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{attendanceSummary.data?.overtimeHours ?? 0} hrs</p>
          </div>
        </div>

        {canViewTeamAttendance && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-red-100 bg-red-50/70 p-4">
              <p className="text-sm font-semibold text-red-700">Late Employees Today</p>
              <div className="mt-3 space-y-2 text-sm">
                {lateRows.length === 0 ? <p className="text-slate-500">No late marks today.</p> : lateRows.slice(0, 6).map((row) => <p key={`late-${row.employeeId}`}>{row.employee.name} - {row.lateMinutes} mins</p>)}
              </div>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
              <p className="text-sm font-semibold text-indigo-700">Overtime Tracking Today</p>
              <div className="mt-3 space-y-2 text-sm">
                {overtimeRows.length === 0 ? <p className="text-slate-500">No overtime yet.</p> : overtimeRows.slice(0, 6).map((row) => <p key={`ot-${row.employeeId}`}>{row.employee.name} - +{row.overtimeHours.toFixed(2)} hrs</p>)}
              </div>
            </div>
          </div>
        )}
      </div>



      {/* ═══ ROW 3 — Chart + Statuses + Quick Links ═══ */}
      {showChartSkeleton ? (
        <DashboardChartsSkeleton />
      ) : (
        <Suspense fallback={<DashboardChartsSkeleton />}>
          <DashboardCharts
            stats={stats as DashboardStats}
            analytics={analyticsSummary.data ?? null}
            analyticsLoading={analyticsSummary.isLoading && !analyticsSummary.data}
            analyticsError={analyticsSummary.error instanceof Error ? analyticsSummary.error.message : null}
            analyticsRefreshing={analyticsSummary.isFetching}
            onRefreshAnalytics={refreshAnalytics}
            tooltipStyle={tooltipStyle}
          />
        </Suspense>
      )}

      <TimesheetsReport />

    </div>
  );
}
