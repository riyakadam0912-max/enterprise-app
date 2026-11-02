'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EmployeeGrowthPoint } from '@/api/reportsApi';

interface Props {
  data: EmployeeGrowthPoint[];
}

export default function EmployeeGrowthChart({ data }: Props) {
  if (!data.length || data.every((item) => item.count === 0)) {
    return <ChartEmptyState message="No employee history available" detail="Add hire dates to employee records to show headcount growth." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="employeeGrowthGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="#dcfce7" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#047857"
          fillOpacity={1}
          fill="url(#employeeGrowthGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ChartEmptyState({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="flex h-70 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-slate-400 shadow-sm" aria-hidden="true">↗</span>
      <p className="text-sm font-semibold text-slate-700">{message}</p>
      <p className="mt-1 max-w-xs text-xs text-slate-500">{detail}</p>
    </div>
  );
}
