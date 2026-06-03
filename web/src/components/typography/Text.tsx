import { cn } from '@/lib/cn';

export function Text({ className, muted = false, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { muted?: boolean }) {
  return <p className={cn(muted ? 'text-slate-500' : 'text-slate-700', className)} {...props} />;
}
