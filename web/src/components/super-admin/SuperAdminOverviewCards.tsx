'use client';

import { motion } from 'framer-motion';
import { Building2, ShieldCheck, TrendingUp, Users, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { getPlatformStats, type PlatformStats } from '@/api/organizationsApi';
import { useAuthSession } from '@/stores/auth-store';

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return String(num);
}

function buildStats(data: PlatformStats | null | undefined) {
  const fallback = data == null;

  return [
    {
      label: 'Organizations',
      value: fallback ? '—' : formatNumber(data.organizations.total),
      subtitle: fallback ? 'Loading data...' : `+${data.organizations.newThisMonth} this month`,
      icon: Building2,
      tone: 'from-indigo-500 to-blue-500',
    },
    {
      label: 'Active Users',
      value: fallback ? '—' : formatNumber(data.users.active),
      subtitle: fallback ? 'Loading data...' : `${data.users.total.toLocaleString()} total users`,
      icon: Users,
      tone: 'from-emerald-500 to-teal-500',
    },
    {
      label: 'Active Organizations',
      value: fallback ? '—' : formatNumber(data.organizations.active),
      subtitle: fallback ? 'Loading data...' : `${data.organizations.total.toLocaleString()} total organizations`,
      icon: Building2,
      tone: 'from-violet-500 to-fuchsia-500',
    },
    {
      label: 'Security Events',
      value: fallback ? '—' : formatNumber(data.security.recentEvents),
      subtitle: fallback ? 'Loading data...' : `${data.security.requireReview} require review`,
      icon: ShieldCheck,
      tone: 'from-amber-500 to-orange-500',
    },
  ];
}

export function SuperAdminOverviewCards() {
  const session = useAuthSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: getPlatformStats,
    staleTime: 5 * 60 * 1000,
  });

  const stats = buildStats(data);

  const scopeLabel = session.organizationId
    ? `${session.organizationName ?? 'Selected organization'} and active child organizations`
    : 'All platform organizations';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950">
        <span className="font-semibold">Dashboard scope:</span> {scopeLabel}. Counts include the parent organization and its descendants.
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const loading = isLoading;
        const hasError = Boolean(error) && !data;
        return (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.2 }}>
            <Card className="overflow-hidden border-slate-200/80 bg-white/80 p-5 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className={`mb-4 h-11 w-11 rounded-2xl bg-linear-to-br ${stat.tone} p-3 text-white`}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
              </div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{hasError ? 'Error' : stat.value}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                {loading || hasError ? null : <TrendingUp className="h-4 w-4 text-emerald-500" />}
                {hasError ? 'Could not load data' : stat.subtitle}
              </p>
            </Card>
          </motion.div>
        );
      })}
      </div>
    </div>
  );
}
