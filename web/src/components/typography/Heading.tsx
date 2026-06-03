import { cn } from '@/lib/cn';

export function Heading({ level = 2, className, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { level?: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const Tag = ({ 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const)[level];
  return <Tag className={cn(level === 1 ? 'text-4xl font-semibold tracking-tight text-slate-950' : level === 2 ? 'text-3xl font-semibold tracking-tight text-slate-950' : 'text-2xl font-semibold text-slate-950', className)} {...props} />;
}
