'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { useAuth } from '@/providers/AuthProvider';
import { getActiveOrganizationId, isSuperAdminSession } from '@/stores/auth-store';

const EMPLOYEE_ALLOWED_EXACT_PATHS = ['/dashboard'];
const EMPLOYEE_ALLOWED_PATH_PREFIXES = [
  '/dashboard/attendance',
  '/dashboard/contacts',
  '/dashboard/events',
  '/dashboard/expenses',
  '/dashboard/files',
  '/dashboard/forms',
  '/dashboard/leave',
  '/dashboard/notifications',
  '/dashboard/payroll',
  '/dashboard/payslips',
  '/dashboard/profile',
  '/dashboard/organization',
  '/dashboard/projects',
  '/dashboard/requests',
  '/dashboard/tasks',
  '/dashboard/timesheets',
];

const MANAGER_ALLOWED_EXACT_PATHS = ['/dashboard', '/dashboard/employees'];
const MANAGER_ALLOWED_PATH_PREFIXES = [
  '/dashboard/projects',
  '/dashboard/tasks',
  '/dashboard/invoices',
  '/dashboard/expenses',
  '/dashboard/attendance',
  '/dashboard/events',
  '/dashboard/employees',
  '/dashboard/forms',
  '/dashboard/leave',
  '/dashboard/requests',
  '/dashboard/reports',
  '/dashboard/notifications',
  '/dashboard/profile',
  '/dashboard/timesheets',
];

function isPathAllowed(pathname: string, exactPaths: string[], prefixes: string[]): boolean {
  return exactPaths.includes(pathname) || prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

function isEmployeePathAllowed(pathname: string): boolean {
  return isPathAllowed(pathname, EMPLOYEE_ALLOWED_EXACT_PATHS, EMPLOYEE_ALLOWED_PATH_PREFIXES);
}

function isManagerPathAllowed(pathname: string): boolean {
  return isPathAllowed(pathname, MANAGER_ALLOWED_EXACT_PATHS, MANAGER_ALLOWED_PATH_PREFIXES);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authenticated, loading, session } = useAuth();
  const [checked, setChecked] = useState(false);
  const [, startTransition] = useTransition();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.shiftKey || event.deltaY === 0 || !(event.target instanceof Element)) return;

      let candidate = event.target instanceof HTMLElement ? event.target : event.target.parentElement;
      let horizontalScroller: HTMLElement | null = null;

      while (candidate && candidate !== main) {
        const overflowX = window.getComputedStyle(candidate).overflowX;
        if ((overflowX === 'auto' || overflowX === 'scroll') && candidate.scrollWidth > candidate.clientWidth) {
          horizontalScroller = candidate;
          break;
        }
        candidate = candidate.parentElement;
      }

      if (!horizontalScroller && main.scrollWidth > main.clientWidth) {
        horizontalScroller = main;
      }

      if (!horizontalScroller) return;

      event.preventDefault();
      horizontalScroller.scrollLeft += event.deltaY;
    };

    main.addEventListener('wheel', handleWheel, { passive: false });
    return () => main.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!authenticated) {
      router.replace('/login');
      return;
    }

    const role = session.role;
    const isSuperAdmin = isSuperAdminSession(session);
    const isImpersonating = isSuperAdmin && getActiveOrganizationId() != null;

    if (isSuperAdmin && !isImpersonating && pathname !== '/dashboard/organization') {
      router.replace('/super-admin/dashboard');
      return;
    }

    if (role === 'EMPLOYEE' && !isEmployeePathAllowed(pathname) && !(session.isBusinessUnitAdmin && pathname === '/dashboard/business-units')) {
      router.replace('/dashboard');
      return;
    }

    if (role === 'MANAGER' && !isManagerPathAllowed(pathname) && !(session.isBusinessUnitAdmin && pathname === '/dashboard/business-units')) {
      router.replace('/dashboard');
      return;
    }

    startTransition(() => setChecked(true));
  }, [authenticated, loading, pathname, router, session, session.role, session.roles, session.isSuperAdmin, session.isPlatformAdmin, startTransition]);

  if (loading || !checked) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.10),transparent_28%),linear-gradient(135deg,#fff7ed_0%,#ffffff_35%,#fffaf5_100%)]">
      <Sidebar currentPath={pathname} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main ref={mainRef} className="flex-1 overscroll-contain overflow-y-auto p-3 sm:p-4 lg:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
