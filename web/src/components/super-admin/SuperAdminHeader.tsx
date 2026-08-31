'use client';

import { useMemo } from 'react';
import { ChevronRight, Menu, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuthSession } from '@/stores/auth-store';
import NotificationBell from '@/components/notifications/NotificationBell';

const superAdminNavItems = [
  { label: 'Dashboard', href: '/super-admin/dashboard' },
  { label: 'Organizations', href: '/super-admin/organizations' },
  { label: 'Users', href: '/super-admin/users' },
  { label: 'Roles & Permissions', href: '/super-admin/roles' },
  { label: 'Audit Logs', href: '/super-admin/audit-logs' },
  { label: 'Reports', href: '/super-admin/reports' },
  { label: 'System Settings', href: '/super-admin/settings' },
];

export function SuperAdminHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
  const pathname = usePathname();
  const session = useAuthSession();

  const breadcrumbs = useMemo(() => {
    const current = superAdminNavItems.find((item) => pathname === item.href || pathname.startsWith(item.href + '/'));
    const segments = pathname.split('/').filter(Boolean);
    const title = current?.label ?? (segments[segments.length - 1] ?? 'Overview').replace(/-/g, ' ');
    return [
      { label: 'Super Admin', href: '/super-admin/dashboard' },
      { label: title, href: pathname },
    ];
  }, [pathname]);

  return (
    <header className="border-b border-slate-200/80 bg-white/80 px-4 py-4 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.28)] backdrop-blur sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50 lg:hidden"
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.24em] text-slate-500 sm:flex">
            <Sparkles className="h-3.5 w-3.5" />
            Premium control center
          </div>
          <nav className="flex items-center gap-2 text-sm text-slate-500">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center gap-2">
                {index > 0 ? <ChevronRight className="h-4 w-4" /> : null}
                <Link href={crumb.href} className={index === breadcrumbs.length - 1 ? 'font-medium text-slate-900' : 'hover:text-slate-700'}>
                  {crumb.label}
                </Link>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {session.user?.name ? session.user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() : 'SA'}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium text-slate-900">{session.user?.name ?? 'Super Admin'}</p>
                <p className="text-xs text-slate-500">Global operator</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
