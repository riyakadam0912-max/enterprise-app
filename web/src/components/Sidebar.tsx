'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { logout } from '@/utils/logout';

// ── SVG icon components ──────────────────────────────────────────────────────
const stroke = { fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function GridIcon()       { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>; }
function UsersIcon()      { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>; }
function BriefcaseIcon()  { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>; }
function CheckIcon()      { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>; }
function ClockIcon()      { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function CalendarCheckIcon(){ return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg>; }
function FileTextIcon()   { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>; }
function BookIcon()       { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>; }
function FormIcon()       { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>; }
function InboxIcon()      { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><polyline points="22 13 16 13 14 16 10 16 8 13 2 13"/><path d="M5.45 5.11L2 13v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-7.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>; }
function MegaphoneIcon()  { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>; }
function RupeeIcon()      { return <span className="inline-flex w-4.25 h-4.25 shrink-0 items-center justify-center text-[15px] font-semibold leading-none">₹</span>; }
function WalletIcon()     { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><path d="M21 8H3a2 2 0 00-2 2v8a2 2 0 002 2h18a2 2 0 002-2v-8a2 2 0 00-2-2z"/><path d="M16 8V6a2 2 0 00-2-2H5"/><circle cx="17" cy="14" r="1"/></svg>; }
function FolderIcon()     { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>; }
function ContactsIcon()   { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 11l-4 4-1.5-1.5"/></svg>; }
function EventsIcon()     { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function TrendingUpIcon() { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>; }
function TagIcon()        { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>; }
function LeadsIcon()      { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" {...stroke}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/><path d="M18 14l2 2 4-4"/></svg>; }
function ShoppingBagIcon()  { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>; }
function CreditCardIcon()   { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>; }
function BarChartIcon()     { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 shrink-0 ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChevronUpDownIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Child item icons ──────────────────────────────────────────────────────────
function PlusCircleIcon()  { return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>; }
function ReportIcon()      { return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>; }
function KanbanIcon()      { return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="11" rx="1"/><rect x="17" y="3" width="5" height="14" rx="1"/></svg>; }
function QuoteIcon()      { return <svg viewBox="0 0 24 24" className="w-4.25 h-4.25 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>; }

// ── Navigation config ─────────────────────────────────────────────────────────
type ChildItem = { label: string; href: string; icon?: React.ReactNode };
type NavLink     = { type: 'link';     label: string; href: string; icon: React.ReactNode };
type NavDropdown = { type: 'dropdown'; id: string;   label: string; icon: React.ReactNode; children: ChildItem[] };
type NavItem = NavLink | NavDropdown;

const navConfig: NavItem[] = [
  { type: 'link', label: 'Dashboard', href: '/dashboard', icon: <GridIcon /> },
  {
    type: 'dropdown', id: 'timesheets', label: 'Timesheets', icon: <ClockIcon />,
    children: [
      { label: '+ Timesheets',      href: '/dashboard/timesheets/add',       icon: <PlusCircleIcon /> },
      { label: 'Timesheets Report', href: '/dashboard/timesheets',           icon: <ReportIcon /> },
      { label: 'Statuses',          href: '/dashboard/timesheets/statuses',  icon: <KanbanIcon /> },
    ],
  },
  { type: 'link', label: 'Attendance', href: '/dashboard/attendance', icon: <CalendarCheckIcon /> },
  {
    type: 'dropdown', id: 'campaign-leads', label: 'Campaign Leads', icon: <TrendingUpIcon />,
    children: [
      { label: '+ Campaign Leads',    href: '/dashboard/campaign-leads/add',          icon: <PlusCircleIcon /> },
      { label: 'Campaign Leads R...', href: '/dashboard/campaign-leads',              icon: <ReportIcon /> },
      { label: 'Source Types',        href: '/dashboard/campaign-leads/source-types', icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'leads', label: 'Leads', icon: <LeadsIcon />,
    children: [
      { label: '+ Leads',      href: '/dashboard/leads/add',      icon: <PlusCircleIcon /> },
      { label: 'Leads Report', href: '/dashboard/leads',          icon: <ReportIcon /> },
      { label: 'Statuses',     href: '/dashboard/leads/statuses', icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'deals', label: 'Deals', icon: <BriefcaseIcon />,
    children: [
      { label: '+ Deals',   href: '/dashboard/deals/add',    icon: <PlusCircleIcon /> },
      { label: 'All Deals', href: '/dashboard/deals',        icon: <ReportIcon /> },
      { label: 'Pipeline',  href: '/dashboard/deals/pipeline', icon: <KanbanIcon /> },
      { label: 'Stages',    href: '/dashboard/deals/stages', icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'quotes', label: 'Quotes', icon: <QuoteIcon />,
    children: [
      { label: '+ New Quote', href: '/dashboard/quotes/add', icon: <PlusCircleIcon /> },
      { label: 'All Quotes',  href: '/dashboard/quotes',     icon: <ReportIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'products', label: 'Products', icon: <ShoppingBagIcon />,
    children: [
      { label: '+ Add Product',  href: '/dashboard/products/add', icon: <PlusCircleIcon /> },
      { label: 'All Products',   href: '/dashboard/products',     icon: <ReportIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'invoices', label: 'Invoices', icon: <FileTextIcon />,
    children: [
      { label: '+ Invoices',   href: '/dashboard/invoices/add',      icon: <PlusCircleIcon /> },
      { label: 'All Invoices', href: '/dashboard/invoices',           icon: <ReportIcon /> },
      { label: 'Statuses',     href: '/dashboard/invoices/statuses',  icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'link', label: 'Payments', href: '/dashboard/payments', icon: <CreditCardIcon />,
  },
  {
    type: 'link', label: 'Payroll', href: '/dashboard/payroll', icon: <WalletIcon />,
  },
  {
    type: 'link', label: 'Reports', href: '/dashboard/reports', icon: <BarChartIcon />,
  },
  {
    type: 'dropdown', id: 'ledger', label: 'Ledger', icon: <BookIcon />,
    children: [
      { label: '+ Ledger Entries',  href: '/dashboard/ledger-entries/add', icon: <PlusCircleIcon /> },
      { label: 'All Ledger Entries', href: '/dashboard/ledger-entries',    icon: <ReportIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'requests', label: 'Requests', icon: <InboxIcon />,
    children: [
      { label: '+ Leave Requests', href: '/dashboard/requests/add',         icon: <PlusCircleIcon /> },
      { label: 'All Requests',     href: '/dashboard/requests',             icon: <ReportIcon /> },
      { label: 'Leave Types',      href: '/dashboard/requests/leave-types', icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'tickets', label: 'Tickets', icon: <TagIcon />,
    children: [
      { label: '+ Tickets',    href: '/dashboard/tickets/add',          icon: <PlusCircleIcon /> },
      { label: 'All Tickets',  href: '/dashboard/tickets',              icon: <ReportIcon /> },
      { label: 'Ticket Types', href: '/dashboard/tickets/ticket-types', icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'form-submissions', label: 'Form Submissions', icon: <FormIcon />,
    children: [
      { label: '+ Form Submissions',    href: '/dashboard/forms/add',       icon: <PlusCircleIcon /> },
      { label: 'All Form Submissions',  href: '/dashboard/forms',           icon: <ReportIcon /> },
      { label: 'Statuses',              href: '/dashboard/forms/statuses',  icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'expenses', label: 'Expenses', icon: <RupeeIcon />,
    children: [
      { label: '+ Expenses',    href: '/dashboard/expenses/add',            icon: <PlusCircleIcon /> },
      { label: 'All Expenses',  href: '/dashboard/expenses',                icon: <ReportIcon /> },
      { label: 'Categories',    href: '/dashboard/expenses/categories',     icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'projects', label: 'Projects', icon: <FolderIcon />,
    children: [
      { label: '+ Projects',   href: '/dashboard/projects/add',          icon: <PlusCircleIcon /> },
      { label: 'All Projects', href: '/dashboard/projects',              icon: <ReportIcon /> },
      { label: 'Statuses',     href: '/dashboard/projects/statuses',     icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'tasks', label: 'Tasks', icon: <CheckIcon />,
    children: [
      { label: '+ Tasks',    href: '/dashboard/tasks/add',        icon: <PlusCircleIcon /> },
      { label: 'All Tasks',  href: '/dashboard/tasks',            icon: <ReportIcon /> },
      { label: 'Priorities', href: '/dashboard/tasks/priorities', icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'contacts', label: 'Contacts', icon: <ContactsIcon />,
    children: [
      { label: '+ Contacts',        href: '/dashboard/contacts/add',        icon: <PlusCircleIcon /> },
      { label: 'All Contacts',      href: '/dashboard/contacts',            icon: <ReportIcon /> },
      { label: 'Contact Statuses',  href: '/dashboard/contacts/statuses',   icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'events', label: 'Events', icon: <EventsIcon />,
    children: [
      { label: '+ Events',     href: '/dashboard/events/add',        icon: <PlusCircleIcon /> },
      { label: 'All Events',   href: '/dashboard/events',            icon: <ReportIcon /> },
      { label: 'Event Types',  href: '/dashboard/events/event-types', icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'campaigns', label: 'Marketing Campaigns', icon: <MegaphoneIcon />,
    children: [
      { label: '+ Marketing Campai...', href: '/dashboard/marketing-campaigns/add',      icon: <PlusCircleIcon /> },
      { label: 'All Marketing Cam...',  href: '/dashboard/marketing-campaigns',           icon: <ReportIcon /> },
      { label: 'Channels',              href: '/dashboard/marketing-campaigns/channels',  icon: <KanbanIcon /> },
    ],
  },
  {
    type: 'dropdown', id: 'employees', label: 'Employees', icon: <UsersIcon />,
    children: [
      { label: '+ Employees',   href: '/dashboard/employees/add' },
      { label: 'All Employees', href: '/dashboard/employees' },
      { label: 'Departments',   href: '/dashboard/employees/departments' },
    ],
  },
  {
    type: 'dropdown', id: 'dynamic-forms', label: 'Dynamic Forms', icon: <FormIcon />,
    children: [
      { label: '+ Dynamic Forms',   href: '/dashboard/dynamic-forms/add' },
      { label: 'All Dynamic Forms', href: '/dashboard/dynamic-forms' },
      { label: 'Target Modules',    href: '/dashboard/dynamic-forms/target-modules' },
    ],
  },
  {
    type: 'link', label: 'User Management', href: '/dashboard/users', icon: <UsersIcon />,
  },
];

interface SidebarProps {
  currentPath: string;
}

type UserRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

const EMPLOYEE_VISIBLE_LABELS = new Set([
  'Dashboard',
  'Leads',
  'Deals',
  'Contacts',
  'Tasks',
  'Projects',
  'Timesheets',
  'Attendance',
  'Requests',
]);

const MANAGER_VISIBLE_LABELS = new Set([
  'Dashboard',
  'Tasks',
  'Projects',
]);

function getMatchedDropdownId(items: NavItem[], path: string): string | null {
  const match = items.find(
    (item): item is NavDropdown =>
      item.type === 'dropdown' &&
      item.children.some((c) => path === c.href || path.startsWith(c.href + '/')),
  );
  return match ? match.id : null;
}

export default function Sidebar({ currentPath }: SidebarProps) {
  const [role] = useState<UserRole>(() => {
    if (typeof window === 'undefined') return 'ADMIN';
    const storedRole = localStorage.getItem('role');
    if (storedRole === 'EMPLOYEE') return 'EMPLOYEE';
    if (storedRole === 'MANAGER') return 'MANAGER';
    if (storedRole === 'HR') return 'HR';
    return 'ADMIN';
  });
  const [currentUser] = useState<{
    name: string;
    email: string;
    role?: string;
    jobTitle?: string;
    designation?: string;
    position?: string;
    department?: string;
    team?: string;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    const rawUser = localStorage.getItem('currentUser');
    if (!rawUser) return null;

    try {
      const parsed = JSON.parse(rawUser) as {
        name?: string;
        email?: string;
        role?: string;
        jobTitle?: string;
        designation?: string;
        position?: string;
        department?: string;
        team?: string;
      };
      if (!parsed.name && !parsed.email) return null;
      return {
        name: parsed.name ?? 'User',
        email: parsed.email ?? '',
        role: parsed.role,
        jobTitle: parsed.jobTitle,
        designation: parsed.designation,
        position: parsed.position,
        department: parsed.department,
        team: parsed.team,
      };
    } catch {
      return null;
    }
  });
  const [openMenu, setOpenMenu] = useState<string | null>(() => {
    const initialItems = role === 'EMPLOYEE'
      ? navConfig.filter((item) => EMPLOYEE_VISIBLE_LABELS.has(item.label))
      : role === 'MANAGER'
        ? navConfig.filter((item) => MANAGER_VISIBLE_LABELS.has(item.label))
        : navConfig;
    return getMatchedDropdownId(initialItems, currentPath);
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const visibleNavConfig = useMemo(
    () => {
      if (role === 'EMPLOYEE') {
        return navConfig.filter((item) => EMPLOYEE_VISIBLE_LABELS.has(item.label));
      }
      if (role === 'MANAGER') {
        return navConfig.filter((item) => MANAGER_VISIBLE_LABELS.has(item.label));
      }
      return navConfig;
    },
    [role],
  );

  // Only one dropdown open at a time
  const toggleMenu = (id: string) => {
    setOpenMenu((prev) => (prev === id ? null : id));
  };

  // Close user dropdown when clicking outside
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  return (
    <aside className="w-65 bg-[#111827] flex flex-col h-full overflow-hidden shrink-0">

      {/* ── Brand ── */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/30">
            <span className="text-white text-base font-bold">E</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-[13px] font-bold leading-tight truncate">Enterprise</p>
            <p className="text-slate-400 text-[10px] leading-tight">Management System</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
<nav className="flex-1 overflow-y-auto py-3 px-2.5 scrollbar-hide">
  {visibleNavConfig.map((item) => {

    // ── Flat link ──
    if (item.type === 'link') {
      const isActive = item.href === '/dashboard'
        ? currentPath === '/dashboard'
        : currentPath === item.href || currentPath.startsWith(item.href + '/');

      return (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all mb-0.5 ${
            isActive
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          {item.icon}
          {item.label}
        </Link>
      );
    }

    // ── Dropdown ──
    const isOpen           = openMenu === item.id;
    const isAnyChildActive = item.children.some(
      (c) => currentPath === c.href || currentPath.startsWith(c.href + '/')
    );

    return (
      <div key={item.id} className="mb-0.5">

        {/* Parent row */}
        <button
          onClick={() => toggleMenu(item.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
            isAnyChildActive && !isOpen
              ? 'text-orange-400 bg-orange-500/10'
              : isOpen
                ? 'text-slate-200 bg-slate-800'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronRightIcon
            className={`transition-transform duration-200 ${
              isOpen ? 'rotate-90' : ''
            } ${
              isAnyChildActive && !isOpen ? 'text-orange-400' : 'text-slate-500'
            }`}
          />
        </button>

        {/* Children */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isOpen ? 'max-h-125 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="ml-3.5 pl-4 border-l border-slate-700/50 mt-1 mb-1 space-y-0.5">
            {item.children.map((child) => {
              const isChildActive =
                currentPath === child.href ||
                currentPath.startsWith(child.href + '/');

              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`flex items-center gap-2.5 px-3 py-1.75 rounded-lg text-xs font-medium transition-all ${
                    isChildActive
                      ? 'text-orange-400 bg-orange-500/15'
                      : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                  }`}
                >
                  {child.icon ? (
                    <span className={isChildActive ? 'text-orange-400' : 'text-slate-500'}>
                      {child.icon}
                    </span>
                  ) : (
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                        isChildActive ? 'bg-orange-400' : 'bg-slate-600'
                      }`}
                    />
                  )}
                  {child.label}
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    );
  })}
</nav>

      {/* ── User profile (dropdown opens upward) ── */}
      <div className="border-t border-white/10 p-3 relative" ref={userMenuRef}>

        {/* Popup menu */}
        <div
          className={`absolute bottom-full left-3 right-3 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 transition-all duration-200 ease-in-out origin-bottom ${
            userMenuOpen ? 'opacity-100 scale-y-100 pointer-events-auto' : 'opacity-0 scale-y-95 pointer-events-none'
          }`}
        >
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-3 px-4 py-3 text-slate-300 text-[13px] font-medium hover:bg-slate-700 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" {...stroke}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Profile
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 text-[13px] font-medium hover:bg-slate-700 transition-colors border-t border-slate-700/60"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" {...stroke}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>
        </div>

        {/* Profile trigger */}
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            userMenuOpen ? 'bg-slate-800' : 'hover:bg-slate-800'
          }`}
        >
          <div className="relative w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">{(currentUser?.name?.charAt(0) ?? 'U').toUpperCase()}</span>
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#111827]" />
          </div>
          <div className="flex-1 text-left min-w-0 leading-tight">
            <p className="text-slate-100 text-[13px] font-semibold truncate">{currentUser?.name ?? 'User'}</p>
            <p className="text-slate-500 text-[10px] font-medium truncate">
              {currentUser?.jobTitle ?? currentUser?.designation ?? currentUser?.position ?? currentUser?.role ?? role}
            </p>
            {(currentUser?.department || currentUser?.team) && (
              <p className="text-slate-500 text-[9px] truncate">
                {currentUser?.department ?? currentUser?.team}
              </p>
            )}
          </div>
          <ChevronUpDownIcon open={userMenuOpen} />
        </button>

      </div>

    </aside>
  );
}
