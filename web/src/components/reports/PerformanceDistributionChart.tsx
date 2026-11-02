'use client';

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { PerformanceDistributionPoint } from '@/api/reportsApi';

const COLORS = ['#dc2626', '#f97316', '#eab308', '#16a34a'];

interface Props {
  data: PerformanceDistributionPoint[];
}

export default function PerformanceDistributionChart({ data }: Props) {
  if (!data.length || data.every((item) => item.count === 0)) {
    return <ChartEmptyState message="No performance reviews for this period" detail="Completed reviews will appear here by rating bucket." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="bucket"
          cx="50%"
          cy="50%"
          outerRadius={95}
          label={(props) => {
            const bucket = (props.payload as { bucket?: string } | undefined)?.bucket ?? '';
            return `${bucket}: ${props.value ?? 0}`;
          }}
        >
          {data.map((entry, idx) => (
            <Cell key={entry.bucket} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ChartEmptyState({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="flex h-70 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-slate-400 shadow-sm" aria-hidden="true">◌</span>
      <p className="text-sm font-semibold text-slate-700">{message}</p>
      <p className="mt-1 max-w-xs text-xs text-slate-500">{detail}</p>
    </div>
  );
}
