'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

const EMPLOYEE_ALLOWED_PATH_PREFIXES = [
  '/dashboard',
  '/dashboard/leads',
  '/dashboard/deals',
  '/dashboard/contacts',
  '/dashboard/tasks',
  '/dashboard/projects',
  '/dashboard/timesheets',
  '/dashboard/attendance',
  '/dashboard/requests',
];

const MANAGER_ALLOWED_PATH_PREFIXES = [
  '/dashboard',
  '/dashboard/projects',
  '/dashboard/tasks',
];

function isEmployeePathAllowed(pathname: string): boolean {
  return EMPLOYEE_ALLOWED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

function isManagerPathAllowed(pathname: string): boolean {
  return MANAGER_ALLOWED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token) {
      router.replace('/login');
      return;
    }

    if (role === 'EMPLOYEE' && !isEmployeePathAllowed(pathname)) {
      router.replace('/dashboard');
      return;
    }

    if (role === 'MANAGER' && !isManagerPathAllowed(pathname)) {
      router.replace('/dashboard');
      return;
    } else {
      startTransition(() => setChecked(true));
    }
  }, [pathname, router, startTransition]);

  if (!checked) {
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
