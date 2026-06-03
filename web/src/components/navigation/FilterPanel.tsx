import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

export function FilterPanel({
  children,
  onClear,
  className,
}: {
  children: React.ReactNode;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('rounded-3xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">{children}</div>
        {onClear ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
