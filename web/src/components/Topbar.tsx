'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  useAuthSession,
  setAuthSession,
  setActiveOrganizationDetails,
  isSuperAdminSession,
  getActiveOrganizationId,
} from '@/stores/auth-store';
import NotificationBell from '@/components/notifications/NotificationBell';
import { BusinessUnitSelector } from '@/components/business-units/BusinessUnitSelector';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { UserAvatar } from '@/components/common/UserAvatar';
import { getMyOrganization, getOrganizationById } from '@/api/organizationsApi';
import ImpersonationBanner from '@/components/super-admin/ImpersonationBanner';

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

  const isSuperAdmin = isSuperAdminSession(session);

  // The org name shown in the badge.
  // For SA: we read from session (which is populated by the effect below).
  // For regular users: session.organizationName is set at login/bootstrap.
  let orgName = session.organizationName;

  // SA without an active impersonation context should show no org badge.
  if (isSuperAdmin) {
    const activeOrgId = typeof window !== 'undefined' ? getActiveOrganizationId() : null;
    if (activeOrgId == null) {
      orgName = null;
    }
  }

  // --- Super Admin: fetch & persist org name/logo whenever active org changes ---
  // We track the last fetched org id to avoid redundant requests.
  const lastFetchedOrgIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;

    const activeOrgId = getActiveOrganizationId();

    if (activeOrgId == null) {
      // No active org — clear any stale display data (already done by clearActiveOrganization,
      // but guard in case the session is loaded from storage with an id but no name yet).
      lastFetchedOrgIdRef.current = null;
      return;
    }

    // If we already have a valid name for this exact org id, nothing to do.
    if (
      lastFetchedOrgIdRef.current === activeOrgId &&
      session.organizationName != null
    ) {
      return;
    }

    lastFetchedOrgIdRef.current = activeOrgId;

    getOrganizationById(activeOrgId)
      .then((org) => {
        setActiveOrganizationDetails({
          name: org.name,
          logoUrl: org.logoUrl ?? null,
          slug: org.slug ?? null,
        });
      })
      .catch(() => {
        // Non-critical — badge will stay empty rather than crash.
      });
  // Re-run whenever the stored organizationId or name changes (covers org switch).
  }, [isSuperAdmin, session.organizationId, session.organizationName]);

  // --- Regular users: fallback fetch if session has no org name yet ---
  useEffect(() => {
    if (orgName || !session.user || session.isSuperAdmin) return;
    if (
      session.role !== 'ADMIN' &&
      session.role !== 'HR' &&
      session.role !== 'MANAGER' &&
      session.role !== 'EMPLOYEE'
    ) return;

    getMyOrganization()
      .then((org) => {
        setAuthSession({ organizationName: org.name, organizationLogo: org.logoUrl ?? null });
      })
      .catch(() => { /* silently ignore */ });
  }, [orgName, session.user, session.role, session.isSuperAdmin]);

  // Build breadcrumb parts from path
  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = [...segments].reverse().find((s) => isNaN(Number(s))) ?? 'dashboard';
  let pageLabel =
    segmentLabels[lastSegment] ??
    lastSegment.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  if (pathname.includes('/edit/')) pageLabel = `Edit ${segmentLabels[segments[segments.indexOf('edit') - 1]] ?? ''}`;
  if (pathname.includes('/add')) pageLabel = `Add ${segmentLabels[segments[segments.indexOf('add') - 1]] ?? ''}`;

  return (
    <header className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-3 shadow-[0_12px_28px_-28px_rgba(15,23,42,0.25)] backdrop-blur-sm sm:px-5">

      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden text-slate-400 font-medium sm:inline">Enterprise Management</span>
        <ChevronRightIcon />
        <span className="truncate text-slate-900 font-semibold">{pageLabel}</span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/80 p-1 md:flex">
          <BusinessUnitSelector />
          <OrganizationSwitcher />
        </div>

        {isSuperAdmin && <ImpersonationBanner />}

        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/80 p-1">
          <NotificationBell />
        </div>

        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <UserAvatar
            userId={session.user?.id}
            fileId={session.avatarFileId}
            name={sessionUser.name}
            className="bg-linear-to-br from-orange-500 to-amber-400 shadow-sm shadow-orange-500/20"
          />
          <div className="hidden sm:block">
            <p className="text-[11px] font-semibold text-slate-800 leading-tight">{sessionUser.name}</p>
            <p className="text-[9px] text-slate-400 leading-tight">{sessionUser.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
