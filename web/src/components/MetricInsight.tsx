import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

interface MetricInsightProps {
  currentValue: number;
  baselineValue: number;
}

function formatPercent(value: number): string {
  return `${Math.abs(value).toFixed(0)}%`;
}

export default function MetricInsight({ currentValue, baselineValue }: MetricInsightProps) {
  const safeBaseline = baselineValue === 0 ? 1 : baselineValue;
  const deltaPercent = ((currentValue - baselineValue) / safeBaseline) * 100;
  const isHigher = deltaPercent > 0;
  const isLower = deltaPercent < 0;
  const isSignificant = Math.abs(deltaPercent) >= 10;

  const directionText = isHigher ? 'higher' : isLower ? 'lower' : 'the same as';
  const summary =
    baselineValue === 0
      ? `Attendance baseline is 0, current value is ${currentValue}.`
      : isLower || isHigher
        ? `Attendance is ${formatPercent(deltaPercent)} ${directionText} than last month.`
        : 'Attendance is unchanged from last month.';

  const containerColor = isSignificant
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : isHigher
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : isLower
        ? 'border-sky-300 bg-sky-50 text-sky-900'
        : 'border-slate-300 bg-slate-50 text-slate-800';

  const iconColor = isSignificant
    ? 'text-amber-600'
    : isHigher
      ? 'text-emerald-600'
      : isLower
        ? 'text-sky-600'
        : 'text-slate-500';

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${containerColor}`}>
      <span className={`mt-0.5 ${iconColor}`}>
        {isHigher ? (
          <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
        ) : isLower ? (
          <ArrowDownRight className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Minus className="h-5 w-5" aria-hidden="true" />
        )}
      </span>

      <p className="text-sm font-medium leading-6">{summary}</p>
    </div>
  );
}
