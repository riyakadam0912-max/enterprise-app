'use client';

import { usePathname } from 'next/navigation';
import { useAuthSession } from '@/stores/auth-store';
import NotificationBell from '@/components/notifications/NotificationBell';
import { BusinessUnitSelector } from '@/components/business-units/BusinessUnitSelector';

const segmentLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  employees: 'Employees',
  users: 'Users',
  leads: 'Leads',
  contacts: 'Contacts',
  deals: 'Deals',
  projects: 'Projects',
  tasks: 'Tasks',
  timesheets: 'Timesheets',
  attendance: 'Attendance',
  invoices: 'Invoices',
  expenses: 'Expenses',
  'ledger-entries': 'Ledger Entries',
  events: 'Events',
  forms: 'Forms',
  'form-submissions': 'Form Submissions',
  requests: 'Requests',
  'marketing-campaigns': 'Marketing Campaigns',
  'campaign-leads': 'Campaign Leads',
  tickets: 'Tickets',
  add: 'Add',
  edit: 'Edit',
  payments: 'Payments',
  reports: 'Reports',
  notifications: 'Notifications',
};


function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function Topbar() {
  const pathname = usePathname();
  const session = useAuthSession();
  const sessionUser = {
    name: session.user?.name ?? 'User',
    role: session.role,
  };

  // Build breadcrumb parts from path
  const segments = pathname.split('/').filter(Boolean);
  // Resolve last meaningful segment label (skip numeric IDs)
  const lastSegment = [...segments].reverse().find((s) => isNaN(Number(s))) ?? 'dashboard';
  let pageLabel = segmentLabels[lastSegment] ?? lastSegment.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  // Special cases for edit/add pages that have IDs
  if (pathname.includes('/edit/')) pageLabel = `Edit ${segmentLabels[segments[segments.indexOf('edit') - 1]] ?? ''}`;
  if (pathname.includes('/add')) pageLabel = `Add ${segmentLabels[segments[segments.indexOf('add') - 1]] ?? ''}`;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 shadow-sm backdrop-blur sm:px-6">

      {/* ── Breadcrumb ── */}
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden text-slate-400 font-medium sm:inline">Enterprise Management</span>
        <ChevronRightIcon />
        <span className="truncate text-slate-900 font-semibold">{pageLabel}</span>
      </div>

      {/* ── Right actions ── */}
      <div className="flex items-center gap-2">

        {/* Business Unit Selector */}
        <BusinessUnitSelector />

        {/* Notification bell */}
        <NotificationBell />

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200" />

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold">{sessionUser.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-slate-800 leading-tight">{sessionUser.name}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{sessionUser.role}</p>
          </div>
        </div>

      </div>
    </header>
  );
}
