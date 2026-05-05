'use client';

import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

type Trend = 'up' | 'down' | 'neutral';
type Tone = 'green' | 'red' | 'slate';

interface AnalyticsKpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  tone: Tone;
  trend: Trend;
  icon: ReactNode;
}

const toneClasses: Record<Tone, string> = {
  green: 'border-emerald-200 bg-emerald-50',
  red: 'border-red-200 bg-red-50',
  slate: 'border-slate-200 bg-slate-50',
};

const accentClasses: Record<Tone, string> = {
  green: 'bg-emerald-600 text-white',
  red: 'bg-red-600 text-white',
  slate: 'bg-slate-900 text-white',
};

const trendConfig: Record<Trend, { icon: ReactNode; label: string }> = {
  up: { icon: <ArrowUpRight className="h-4 w-4" />, label: 'Up' },
  down: { icon: <ArrowDownRight className="h-4 w-4" />, label: 'Down' },
  neutral: { icon: <Minus className="h-4 w-4" />, label: 'Stable' },
};

export default function AnalyticsKpiCard({ title, value, subtitle, tone, trend, icon }: AnalyticsKpiCardProps) {
  const trendItem = trendConfig[trend];

  return (
    <div className={`rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentClasses[tone]}`}>
          {icon}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
          {trendItem.icon}
          {trendItem.label}
        </span>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
    </div>
  );
}