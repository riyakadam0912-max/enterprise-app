'use client';

import { ArrowDownRight, ArrowUpRight, HelpCircle } from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface CompanyHealthKpiCardProps {
  currentValue: number;
  previousValue: number;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function CompanyHealthKpiCard({
  currentValue,
  previousValue,
}: CompanyHealthKpiCardProps) {
  const difference = currentValue - previousValue;
  const hasChange = difference !== 0;
  const isPositive = difference > 0;
  const isNegative = difference < 0;
  const trendPercent = previousValue === 0
    ? currentValue === 0
      ? 0
      : 100
    : Math.abs(((currentValue - previousValue) / previousValue) * 100);

  const chartData = [
    { label: 'Previous', value: previousValue },
    { label: 'Current', value: currentValue },
  ];

  const lineColor = isNegative ? '#ef4444' : '#16a34a';
  const helpText = [
    'This KPI card compares the current health score against the previous score.',
    'The reports analytics service builds the score from report metrics such as attendance, payroll, turnover, and performance.',
    'Attendance is derived from presentDays ÷ totalDays, payroll uses netCost and deductions, turnover uses resignations ÷ average employees, and performance uses avgRating plus goalCompletionRate.',
    'Higher attendance, lower turnover, and stronger performance should raise the score, while payroll pressure and lateness should reduce it.',
  ].join(' ');

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">Company Health</p>
          <div className="mt-2 flex items-end gap-3">
            <h3 className="text-3xl font-bold tracking-tight text-slate-900">
              {formatPercent(currentValue)}
            </h3>
            {hasChange ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {isPositive ? '+' : '-'}{formatPercent(trendPercent)}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                No change
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {isPositive
              ? 'Health improved versus the previous period.'
              : isNegative
                ? 'Health declined versus the previous period.'
                : 'Health is unchanged versus the previous period.'}
          </p>
        </div>

        <div className="relative group shrink-0">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
            aria-label="How company health is calculated"
          >
            <HelpCircle className="h-4.5 w-4.5" />
          </button>

          <div className="pointer-events-none absolute right-0 top-11 z-20 hidden w-80 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-left text-sm text-slate-100 shadow-xl group-hover:block group-focus-within:block">
            <p className="font-semibold text-white">How this metric is calculated</p>
            <p className="mt-2 leading-6 text-slate-300">{helpText}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 h-24 rounded-xl bg-slate-50 px-2 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -16, bottom: 0 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis hide domain={[0, 100]} />
            <Tooltip
              cursor={{ stroke: lineColor, strokeDasharray: '4 4' }}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
              }}
              formatter={(value) => [formatPercent(Number(value)), 'Company Health']}
              labelStyle={{ color: '#0f172a', fontWeight: 600 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={3}
              dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
