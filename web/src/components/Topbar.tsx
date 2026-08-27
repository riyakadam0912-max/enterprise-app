'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthSession, setAuthSession, isSuperAdminSession, getActiveOrganizationId } from '@/stores/auth-store';
import NotificationBell from '@/components/notifications/NotificationBell';
import { BusinessUnitSelector } from '@/components/business-units/BusinessUnitSelector';
import { getMyOrganization } from '@/api/organizationsApi';

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

/** Get initials from a name string (up to 2 chars). */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export default function Topbar() {
  const pathname = usePathname();
  const session = useAuthSession();
  const sessionUser = {
    name: session.user?.name ?? 'User',
    role: session.role,
  };

  // Determine the displayed org name:
  // - For super admins with an active impersonation org, show the impersonated org name.
  // - For regular users, use their session org name.
  const isSuperAdmin = isSuperAdminSession(session);
  let orgName = session.organizationName;
  let orgLogo = session.organizationLogo;

  if (isSuperAdmin) {
    const activeOrgId = typeof window !== 'undefined' ? getActiveOrganizationId() : null;
    if (activeOrgId == null) {
      // Not impersonating — clear org badge for pure SA view
      orgName = null;
      orgLogo = null;
    }
    // If impersonating, session.organizationName should already be set
    // (axiosClient updates it on refresh). If not, it's ok — badge is hidden.
  }

  // Fallback: if session has no org name but user is authenticated with an org,
  // fetch it from /organizations/me and persist it back into the session store.
  useEffect(() => {
    if (orgName || !session.user || session.isSuperAdmin) return;
    if (session.role !== 'ADMIN' && session.role !== 'HR' && session.role !== 'MANAGER' && session.role !== 'EMPLOYEE') return;
    getMyOrganization()
      .then((org) => {
        setAuthSession({ organizationName: org.name, organizationLogo: org.logoUrl ?? null });
      })
      .catch(() => { /* silently ignore */ });
  }, [orgName, session.user, session.role, session.isSuperAdmin]);

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

        {/* Organization name badge */}
        {orgName ? (
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 max-w-[180px]" title={orgName}>
            {orgLogo ? (
              <img
                src={orgLogo}
                alt={orgName}
                className="h-4 w-4 rounded-full object-cover shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              /* Initials fallback — 2-letter avatar */
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[8px] font-bold text-white leading-none">
                {getInitials(orgName)}
              </span>
            )}
            <span className="truncate text-xs font-medium text-slate-700">{orgName}</span>
          </div>
        ) : null}

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
