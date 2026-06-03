'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/cn';
import { DashboardCard } from '@/components/layout/DashboardCard';

export function ChartShell({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <DashboardCard title={title} description={description}>
      <div className={cn('h-80', className)}>{children}</div>
    </DashboardCard>
  );
}

export function EnterpriseLineChart({ data, xKey, lines, className }: { data: Record<string, unknown>[]; xKey: string; lines: Array<{ dataKey: string; stroke: string; name?: string }>; className?: string }) {
  return (
    <div className={cn('h-full w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Legend />
          {lines.map((line) => (
            <Line key={line.dataKey} type="monotone" dataKey={line.dataKey} name={line.name ?? line.dataKey} stroke={line.stroke} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EnterpriseBarChart({ data, xKey, bars, className }: { data: Record<string, unknown>[]; xKey: string; bars: Array<{ dataKey: string; fill: string; name?: string }>; className?: string }) {
  return (
    <div className={cn('h-full w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Legend />
          {bars.map((bar) => (
            <Bar key={bar.dataKey} dataKey={bar.dataKey} name={bar.name ?? bar.dataKey} fill={bar.fill} radius={[10, 10, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EnterpriseAreaChart({ data, xKey, areas, className }: { data: Record<string, unknown>[]; xKey: string; areas: Array<{ dataKey: string; stroke: string; fill: string; name?: string }>; className?: string }) {
  return (
    <div className={cn('h-full w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Legend />
          {areas.map((area) => (
            <Area key={area.dataKey} type="monotone" dataKey={area.dataKey} name={area.name ?? area.dataKey} stroke={area.stroke} fill={area.fill} fillOpacity={0.18} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EnterprisePieChart({ data, dataKey, nameKey, colors, className }: { data: Record<string, unknown>[]; dataKey: string; nameKey: string; colors: string[]; className?: string }) {
  return (
    <div className={cn('h-full w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie data={data} dataKey={dataKey} nameKey={nameKey} outerRadius={110} innerRadius={60} paddingAngle={2}>
            {data.map((_, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KpiCard({ label, value, trend, tone = 'slate' }: { label: string; value: string | number; trend?: string; tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' }) {
  const tones = {
    slate: 'from-slate-900 to-slate-700',
    emerald: 'from-emerald-600 to-emerald-500',
    amber: 'from-amber-500 to-amber-400',
    rose: 'from-rose-600 to-rose-500',
    sky: 'from-sky-600 to-sky-500',
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={cn('inline-flex rounded-2xl bg-linear-to-br px-3 py-1 text-xs font-semibold text-white', tones[tone])}>{label}</div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
      {trend ? <p className="mt-2 text-sm text-slate-500">{trend}</p> : null}
    </div>
  );
}
