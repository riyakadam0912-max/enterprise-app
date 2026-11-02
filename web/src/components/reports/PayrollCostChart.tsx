'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PayrollCostPoint } from '@/api/reportsApi';

interface Props {
  data: PayrollCostPoint[];
}

export default function PayrollCostChart({ data }: Props) {
  const hasValues = data.some((item) => item.netPay > 0 || item.deductions > 0);
  if (!hasValues) {
    return <ChartEmptyState message="No payroll data for this period" detail="Payroll costs will appear after payroll entries are posted." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#ffe4e6" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="netPay" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
        <Bar dataKey="deductions" fill="#fb7185" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartEmptyState({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="flex h-70 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-slate-400 shadow-sm" aria-hidden="true">₹</span>
      <p className="text-sm font-semibold text-slate-700">{message}</p>
      <p className="mt-1 max-w-xs text-xs text-slate-500">{detail}</p>
    </div>
  );
}
