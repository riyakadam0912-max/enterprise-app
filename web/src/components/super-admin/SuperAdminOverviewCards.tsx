'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, Loader2, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';

import { getPlatformStats, type PlatformStats } from '@/api/organizationsApi';
import { Card } from '@/components/ui/card';
import { useAuthSession } from '@/stores/auth-store';

function formatNumber(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(value);
}

function buildStats(data: PlatformStats | undefined) {
  return [
    { label: 'Organizations', value: data ? formatNumber(data.organizations.total) : '—', detail: data ? `+${data.organizations.newThisMonth} this month` : 'Loading data…', icon: Building2, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Active users', value: data ? formatNumber(data.users.active) : '—', detail: data ? `${data.users.total.toLocaleString()} total users` : 'Loading data…', icon: Users, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Active organizations', value: data ? formatNumber(data.organizations.active) : '—', detail: data ? `${data.organizations.total.toLocaleString()} total organizations` : 'Loading data…', icon: Building2, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Security events', value: data ? formatNumber(data.security.recentEvents) : '—', detail: data ? `${data.security.requireReview} require review` : 'Loading data…', icon: ShieldCheck, tone: 'bg-amber-50 text-amber-700' },
  ];
}

export function SuperAdminOverviewCards() {
  const session = useAuthSession();
  const { data, isLoading, error } = useQuery({ queryKey: ['platform-stats'], queryFn: getPlatformStats, staleTime: 5 * 60 * 1000 });
  const scopeLabel = session.organizationId ? `${session.organizationName ?? 'Selected organization'} and active child organizations` : 'All platform organizations';
  const stats = buildStats(data);
  const attentionItems = data ? [
    { label: 'Audit events requiring review', value: data.security.requireReview, href: '/super-admin/audit-logs', action: 'Review audit log' },
    { label: 'Inactive organizations', value: Math.max(0, data.organizations.total - data.organizations.active), href: '/super-admin/organizations', action: 'Manage organizations' },
    { label: 'Inactive users', value: Math.max(0, data.users.total - data.users.active), href: '/super-admin/users', action: 'Manage users' },
  ] : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.75fr)]">
      <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-none">
        <div className="flex flex-col gap-1 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-slate-950">Platform overview</h2><p className="mt-1 text-sm text-slate-500">{scopeLabel}</p></div>
          <span className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-400 sm:mt-0">Live platform data</span>
        </div>
        <div className="grid sm:grid-cols-2">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            const hasError = Boolean(error) && !data;
            return (
              <div key={stat.label} className={`border-slate-200 p-5 ${index % 2 === 0 ? 'sm:border-r' : ''} ${index < 2 ? 'border-b' : ''}`}>
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${stat.tone}`}>{isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}</div>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{hasError ? 'Error' : stat.value}</p>
                <p className="mt-2 text-sm text-slate-500">{hasError ? 'Could not load data' : stat.detail}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-none">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-950">Needs attention</h2><p className="mt-1 text-sm text-slate-500">Operational follow-ups from current platform data.</p></div>
        <div className="divide-y divide-slate-200">
          {isLoading ? (
            <div className="flex items-center gap-3 px-5 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading action queue…</div>
          ) : error && !data ? (
            <div className="px-5 py-8 text-sm text-rose-600">The action queue could not be loaded.</div>
          ) : attentionItems.map((item) => (
            <Link key={item.label} href={item.href} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50">
              <span className={`flex h-9 min-w-9 items-center justify-center rounded-full text-sm font-semibold ${item.value > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{item.value}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-800">{item.label}</span><span className="mt-0.5 block text-xs text-slate-500">{item.value > 0 ? item.action : 'No action needed'}</span></span>
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
