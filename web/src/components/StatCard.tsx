interface StatCardProps {
  title: string;
  value: number | string;
  icon: string;
  trend?: number;
  description?: string;
  color?: 'orange' | 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'cyan';
  currency?: 'rupees' | 'none';
}

const colorStyles = {
  orange: 'bg-white border border-slate-200 text-slate-900 shadow-sm',
  blue: 'from-blue-50 to-blue-100 border-blue-200 text-blue-700',
  green: 'from-green-50 to-green-100 border-green-200 text-green-700',
  purple: 'from-purple-50 to-purple-100 border-purple-200 text-purple-700',
  amber: 'from-amber-50 to-amber-100 border-amber-200 text-amber-700',
  red: 'from-red-50 to-red-100 border-red-200 text-red-700',
  cyan: 'from-cyan-50 to-cyan-100 border-cyan-200 text-cyan-700',
};

const iconBgStyles = {
  orange: 'bg-orange-500 text-white',
  blue: 'bg-blue-200 text-blue-700',
  green: 'bg-green-200 text-green-700',
  purple: 'bg-purple-200 text-purple-700',
  amber: 'bg-amber-200 text-amber-700',
  red: 'bg-red-200 text-red-700',
  cyan: 'bg-cyan-200 text-cyan-700',
};

export default function StatCard({
  title,
  value,
  icon,
  trend,
  description,
  color = 'orange',
  currency = 'rupees',
}: StatCardProps) {
  const formatNumber = (num: number | string, curr: string) => {
    if (typeof num === 'number') {
      if (curr === 'rupees') {
        return new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(num);
      }
      if (curr === 'none') {
        return Number.isInteger(num) ? num.toString() : num.toFixed(2);
      }
      return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(num);
    }
    return num;
  };

  const getCurrencySymbol = (curr: string) => {
    if (curr === 'rupees') return '₹';
    if (curr === 'none') return '';
    return '₹';
  };

  const isBgGradient = color === 'orange';

  return (
    <div className={`${isBgGradient ? `bg-linear-to-br ${colorStyles[color]}` : `bg-linear-to-br ${colorStyles[color]} border`} rounded-xl p-4 transition hover:shadow-lg`}>
      <div className="flex items-center justify-start gap-3">
        <div className={`${iconBgStyles[color]} rounded-lg p-2 text-lg w-fit shrink-0`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-lg font-bold ${isBgGradient ? 'text-orange-500' : 'text-slate-900'}`}>{getCurrencySymbol(currency)} {formatNumber(value, currency)}</h3>
          <p className={`text-xs font-medium ${isBgGradient ? 'text-slate-600' : 'text-slate-600'} mt-1`}>{title}</p>
        </div>
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <span className={`text-xs font-semibold ${isBgGradient ? 'text-slate-900' : trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
          <span className={`text-xs ${isBgGradient ? 'text-slate-500' : 'text-slate-500'}`}>vs last month</span>
        </div>
      )}
    </div>
  );
}
