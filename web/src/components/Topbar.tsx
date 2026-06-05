'use client';

import { usePathname } from 'next/navigation';
import { useAuthSession } from '@/stores/auth-store';
import NotificationBell from '@/components/notifications/NotificationBell';

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
  products: 'Products',
  payments: 'Payments',
  reports: 'Reports',
  notifications: 'Notifications',
};


function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

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
    <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between shrink-0 shadow-sm">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-slate-400 font-medium">Enterprise Management</span>
        <ChevronRightIcon />
        <span className="text-slate-900 font-semibold">{pageLabel}</span>
      </div>

      {/* ── Right actions ── */}
      <div className="flex items-center gap-2">

        {/* Notification bell */}
        <NotificationBell />

        {/* Total entries chip */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-700">14 Total</span>
        </div>

        {/* Days chip */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
          <CalendarIcon />
          <span className="text-xs font-semibold text-slate-700">30 Days</span>
        </div>

        {/* Upgrade button */}
        <button className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-orange-500/30">
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          Upgrade
        </button>

        {/* Help icon */}
        <button className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
          <HelpIcon />
        </button>

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
