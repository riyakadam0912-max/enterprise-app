'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import ImpersonationBanner from '@/components/super-admin/ImpersonationBanner';
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

    if (isSuperAdmin && !isImpersonating) {
      router.replace('/super-admin/dashboard');
      return;
    }

    if (role === 'EMPLOYEE' && !isEmployeePathAllowed(pathname)) {
      router.replace('/dashboard');
      return;
    }

    if (role === 'MANAGER' && !isManagerPathAllowed(pathname)) {
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
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar currentPath={pathname} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <ImpersonationBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
