type Trend = 'up' | 'down' | 'neutral';

interface ExecutiveKpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  tone: 'green' | 'red' | 'slate';
  trend: Trend;
}

const toneClasses: Record<ExecutiveKpiCardProps['tone'], string> = {
  green: 'border-emerald-200 bg-emerald-50',
  red: 'border-red-200 bg-red-50',
  slate: 'border-slate-200 bg-white',
};

const valueClasses: Record<ExecutiveKpiCardProps['tone'], string> = {
  green: 'text-emerald-700',
  red: 'text-red-700',
  slate: 'text-slate-900',
};

const trendSymbol: Record<Trend, string> = {
  up: '↑',
  down: '↓',
  neutral: '→',
};

export default function ExecutiveKpiCard(props: ExecutiveKpiCardProps) {
  const { title, value, subtitle, tone, trend } = props;

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className={`text-3xl font-semibold ${valueClasses[tone]}`}>{value}</p>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-sm font-semibold text-slate-600">
          {trendSymbol[trend]}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
    </div>
  );
}
