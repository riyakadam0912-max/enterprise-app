'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AttendanceTrendPoint } from '@/api/reportsApi';

interface Props {
  data: AttendanceTrendPoint[];
}

export default function AttendanceTrendChart({ data }: Props) {
  if (!data.length) {
    return <ChartEmptyState message="No attendance records for this period" detail="Try another month or adjust the report scope." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#dbeafe" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="present" stroke="#0891b2" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartEmptyState({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="flex h-70 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-slate-400 shadow-sm" aria-hidden="true">∿</span>
      <p className="text-sm font-semibold text-slate-700">{message}</p>
      <p className="mt-1 max-w-xs text-xs text-slate-500">{detail}</p>
    </div>
  );
}
