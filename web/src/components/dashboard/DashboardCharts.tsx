'use client';

import { memo, useMemo } from 'react';
import Link from 'next/link';
import {
  CartesianGrid,
  Bar,
  BarChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Coins, RefreshCw, TimerReset } from 'lucide-react';
import type { DashboardStats } from '@/api/dashboardApi';
import type { AnalyticsSummary } from '@/api/analyticsApi';
import { useStableNow } from '@/hooks/useStableNow';
import { formatInrCurrency } from '@/utils/formatCurrency';
import AnalyticsKpiCard from './AnalyticsKpiCard';
import AnalyticsKpiSkeleton from './AnalyticsKpiSkeleton';

const HOURS_DATA = [
  { x: 2.5, y: 3 },
  { x: 4.2, y: 4 },
  { x: 4.8, y: 5 },
  { x: 5.9, y: 6 },
  { x: 7.5, y: 8 },
  { x: 9.2, y: 10 },
  { x: 11.8, y: 12 },
];

const QUICK_LINKS = [
  { label: 'Add New Timesheets', href: '/dashboard/timesheets' },
  { label: 'Add New Campaign Lead', href: '/dashboard/campaign-leads' },
  { label: 'Add New Deals', href: '/dashboard/deals' },
  { label: 'Add New Leave Request', href: '/dashboard/requests' },
];

function formatWorkflowAction(action: string) {
  return action.replaceAll('_', ' ').toLowerCase();
}

function formatWorkflowTime(at: string, currentTime: number) {
  const startedAt = new Date(at).getTime();
  if (Number.isNaN(startedAt)) return '';

  const diffMinutes = Math.max(0, Math.floor((currentTime - startedAt) / (1000 * 60)));
  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

type DashboardChartsProps = {
  stats: DashboardStats;
  analytics?: AnalyticsSummary | null;
  analyticsLoading: boolean;
  analyticsError: string | null;
  analyticsRefreshing: boolean;
  onRefreshAnalytics: () => void;
  tooltipStyle: {
    backgroundColor: string;
    border: string;
    borderRadius: string;
    color: string;
    fontSize: string;
  };
};

function DashboardCharts({
  stats,
  analytics,
  analyticsLoading,
  analyticsError,
  analyticsRefreshing,
  onRefreshAnalytics,
  tooltipStyle,
}: DashboardChartsProps) {
  const workflow = stats.workflow;
  const currentTime = useStableNow();
  const statusBoxes = useMemo(
    () => [
      { label: 'Submitted', count: 2, color: 'text-orange-500' },
      { label: 'Approved', count: 1, color: 'text-emerald-600' },
      { label: 'Rejected', count: 2, color: 'text-red-500' },
      { label: 'Total', count: stats.totalTasks ?? 5, color: 'text-blue-600' },
    ],
    [stats.totalTasks],
  );

  const revenueData = useMemo(
    () => (stats.revenueByMonth ?? []).map((item) => ({
      month: item.month,
      revenue: item.revenue,
    })),
    [stats.revenueByMonth],
  );

  const dealsByStageData = useMemo(
    () => Object.entries(stats.dealsByStage ?? {}).map(([stage, total]) => ({
      stage,
      total,
    })),
    [stats.dealsByStage],
  );

  const analyticsBurnData = useMemo(
    () => (analytics ? [{ label: 'Current Month', payroll: analytics.burnRate.payroll, expenses: analytics.burnRate.expenses }] : []),
    [analytics],
  );

  const workflowTiles = useMemo(
    () =>
      workflow
        ? [
            {
              label: 'Pending leave approvals',
              value: workflow.pendingLeaves,
              hint: 'Leave requests waiting in the queue',
            },
            {
              label: 'Pending expense approvals',
              value: workflow.pendingExpenses,
              hint: 'Expense submissions awaiting review',
            },
            {
              label: 'Aging approvals',
              value: workflow.agingApprovals,
              hint: 'Open items older than 48h',
            },
            {
              label: 'Overdue approvals',
              value: workflow.overdueApprovals,
              hint: 'Open items older than 72h',
            },
          ]
        : [],
    [workflow],
  );

  const absenteeismRate = analytics?.absenteeism.absenteeismRate ?? 0;
  const absenteeismTone = absenteeismRate > 10 ? 'red' : 'green';
  const revenueVelocityDays = analytics?.revenueVelocity.averageDays ?? 0;
  const revenueVelocityTone = revenueVelocityDays > 30 ? 'red' : 'green';
  const revenueVelocityTrend = revenueVelocityDays > 30 ? 'up' : 'down';

  return (
    <>
      {workflow && (
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Workflow Visibility</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Action center for managers and admins</h2>
              <p className="mt-2 text-sm text-slate-500">
                Pending leave and expense work, plus aging approvals and recent transitions, surfaced in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/requests"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Leave queue
              </Link>
              <Link
                href="/dashboard/expenses"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Expense queue
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 xl:grid-cols-4">
              {workflowTiles.map((tile) => (
                <div key={tile.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tile.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{tile.value}</p>
                  <p className="mt-1 text-sm text-slate-500">{tile.hint}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Recent approval activity</p>
                  <p className="text-xs text-slate-500">Latest submissions and decisions</p>
                </div>
                <Activity className="h-4 w-4 text-slate-400" />
              </div>

              <div className="mt-4 space-y-3">
                {workflow.recentActivity.length > 0 ? (
                  workflow.recentActivity.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              {item.type}
                            </span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              {formatWorkflowAction(item.action)}
                            </span>
                            <span className="text-[11px] text-slate-400">{formatWorkflowTime(item.at, currentTime)}</span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">Status: {item.status}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No recent workflow activity yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Executive Analytics</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Summary signal for leadership</h2>
            <p className="mt-2 text-sm text-slate-500">
              One cached summary endpoint powers absenteeism, burn rate, and revenue velocity across the dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshAnalytics}
            disabled={analyticsRefreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${analyticsRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {analyticsLoading && !analytics ? (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <AnalyticsKpiSkeleton />
            <AnalyticsKpiSkeleton />
            <AnalyticsKpiSkeleton />
          </div>
        ) : analyticsError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load analytics summary: {analyticsError}
          </div>
        ) : analytics ? (
          <>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <AnalyticsKpiCard
                title="Absenteeism"
                value={`${absenteeismRate.toFixed(2)}%`}
                subtitle={`${analytics.absenteeism.presentCount} present out of ${analytics.absenteeism.totalEmployees} employees`}
                tone={absenteeismTone}
                trend={absenteeismTone === 'red' ? 'down' : 'up'}
                icon={<Activity className="h-5 w-5" />}
              />
              <AnalyticsKpiCard
                title="Total Burn Rate"
                value={formatInrCurrency(analytics.burnRate.total)}
                subtitle={`Payroll ${formatInrCurrency(analytics.burnRate.payroll)} + Expenses ${formatInrCurrency(analytics.burnRate.expenses)}`}
                tone="slate"
                trend="neutral"
                icon={<Coins className="h-5 w-5" />}
              />
              <AnalyticsKpiCard
                title="Revenue Velocity"
                value={`${revenueVelocityDays.toFixed(2)} days`}
                subtitle="Average time from deal creation to won status"
                tone={revenueVelocityTone}
                trend={revenueVelocityTrend}
                icon={<TimerReset className="h-5 w-5" />}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 shadow-sm lg:col-span-3">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Payroll vs Expenses</p>
                    <p className="text-xs text-slate-500">Current month burn composition</p>
                  </div>
                  <div className="text-xs font-medium text-slate-500">Single source of truth</div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analyticsBurnData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar isAnimationActive={false} dataKey="payroll" name="Payroll" fill="#f97316" radius={[8, 8, 0, 0]} />
                    <Bar isAnimationActive={false} dataKey="expenses" name="Expenses" fill="#0f766e" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
                <p className="text-sm font-semibold text-slate-800">Leadership Notes</p>
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Absenteeism signal</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{absenteeismTone === 'red' ? 'Watch attendance' : 'Healthy attendance'}</p>
                    <p className="mt-1">{absenteeismTone === 'red' ? 'Attendance is above the 10% threshold.' : 'Attendance remains within the acceptable threshold.'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Velocity benchmark</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{revenueVelocityTone === 'red' ? 'Needs acceleration' : 'Fast conversion'}</p>
                    <p className="mt-1">Average deal conversion time is {revenueVelocityDays.toFixed(2)} days.</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Burn status</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">Current month burn: {formatInrCurrency(analytics.burnRate.total)}</p>
                    <p className="mt-1">Track payroll and expense consumption from the same cached summary payload.</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Actual Hours by Estimated Hours</h2>
        <div className="flex gap-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" style={{ width: '42%' }}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Hours Analysis</p>
              <span className="text-xs text-slate-400">Actual vs Estimated</span>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="x" name="Actual Hours" type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: 'Actual', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="y" name="Estimated Hours" type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: 'Estimated', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(249,115,22,0.08)' }} />
                <ReferenceLine stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 4" segment={[{ x: 0, y: 0 }, { x: 14, y: 14 }]} />
                <Scatter isAnimationActive={false} data={HOURS_DATA} fill="#f97316" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" style={{ width: '28%' }}>
            <p className="mb-4 text-sm font-semibold text-slate-800">Statuses</p>
            <div className="grid flex-1 grid-cols-2 gap-3">
              {statusBoxes.map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-xl bg-gray-100 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-200">
                    <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className={`text-xl font-bold leading-tight ${item.color}`}>{item.count}</p>
                    <p className="text-[11px] leading-tight text-slate-500">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-1 flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-slate-800">Quick Links</p>
            <div className="flex flex-col gap-1">
              {QUICK_LINKS.map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 py-2 transition-opacity hover:opacity-80">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-500">
                    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-orange-500">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-800">Deals by Stage</p>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">Current sales pipeline distribution</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dealsByStageData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="stage" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar isAnimationActive={false} dataKey="total" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-800">Revenue by Month</p>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">Revenue from won deals</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line isAnimationActive={false} type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

export default memo(DashboardCharts);