import { cn } from '@/lib/cn';

export function Caption({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('text-xs text-slate-500', className)} {...props} />;
}
