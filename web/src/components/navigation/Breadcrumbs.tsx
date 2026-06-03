import Link from 'next/link';
import { cn } from '@/lib/cn';

export function Breadcrumbs({ items, className }: { items: Array<{ label: string; href?: string }>; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex flex-wrap items-center gap-2 text-sm', className)}>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {index > 0 ? <span className="text-slate-300">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="text-slate-500 transition hover:text-slate-900">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-slate-900">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
