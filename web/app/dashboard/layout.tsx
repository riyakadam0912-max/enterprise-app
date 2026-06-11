'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { useAuth } from '@/providers/AuthProvider';

const EMPLOYEE_ALLOWED_EXACT_PATHS = ['/dashboard'];
const EMPLOYEE_ALLOWED_PATH_PREFIXES = [
  '/dashboard/tasks',
  '/dashboard/projects',
  '/dashboard/timesheets',
  '/dashboard/attendance',
  '/dashboard/leave',
  '/dashboard/requests',
  '/dashboard/expenses',
  '/dashboard/payslips',
  '/dashboard/profile',
];

const MANAGER_ALLOWED_EXACT_PATHS = ['/dashboard'];
const MANAGER_ALLOWED_PATH_PREFIXES = [
  '/dashboard/projects',
  '/dashboard/tasks',
  '/dashboard/invoices',
  '/dashboard/expenses',
  '/dashboard/attendance',
  '/dashboard/leave',
  '/dashboard/profile',
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

    if (role === 'EMPLOYEE' && !isEmployeePathAllowed(pathname)) {
      router.replace('/dashboard');
      return;
    }

    if (role === 'MANAGER' && !isManagerPathAllowed(pathname)) {
      router.replace('/dashboard');
      return;
    }

    startTransition(() => setChecked(true));
  }, [authenticated, loading, pathname, router, session.role, startTransition]);

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
          {children}
        </main>
      </div>
    </div>
  );
}
