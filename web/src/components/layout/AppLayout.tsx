import { cn } from '@/lib/cn';

export function AppLayout({
  sidebar,
  topbar,
  children,
  className,
}: {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-h-screen bg-[linear-gradient(180deg,rgba(248,250,252,1)_0%,rgba(255,255,255,1)_100%)] text-slate-950', className)}>
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white/80 backdrop-blur lg:block">{sidebar}</aside>
        <div className="flex min-w-0 flex-col">
          <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">{topbar}</div>
          <main className="min-w-0 flex-1 p-4 sm:p-6 xl:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
