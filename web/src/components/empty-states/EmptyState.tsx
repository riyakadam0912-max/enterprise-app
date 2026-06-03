import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

export function EmptyState({
  title,
  description,
  ctaLabel,
  onCta,
  icon,
  className,
}: {
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center', className)}>
      {icon ? <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p> : null}
      {ctaLabel && onCta ? (
        <Button className="mt-5" onClick={onCta}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}
