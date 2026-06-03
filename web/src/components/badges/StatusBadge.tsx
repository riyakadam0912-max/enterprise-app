import { cn } from '@/lib/cn';

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-700 ring-slate-200',
  PENDING: 'bg-amber-100 text-amber-800 ring-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  REJECTED: 'bg-rose-100 text-rose-800 ring-rose-200',
  COMPLETED: 'bg-sky-100 text-sky-800 ring-sky-200',
  OVERDUE: 'bg-orange-100 text-orange-800 ring-orange-200',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const normalized = status.toUpperCase();
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset', statusStyles[normalized] ?? statusStyles.INACTIVE, className)}>
      {normalized}
    </span>
  );
}
