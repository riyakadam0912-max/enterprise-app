'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconCalendarCheck() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <polyline points="22 13 16 13 14 16 10 16 8 13 2 13" />
      <path d="M5.45 5.11L2 13v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-7.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconRupee() {
  return (
    <span className="inline-flex w-6 h-6 items-center justify-center text-[22px] font-semibold leading-none">
      ₹
    </span>
  );
}

function IconFileText() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconLeads() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" />
      <path d="M18 14l2 2 4-4" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconContacts() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 11l-4 4-1.5-1.5" />
    </svg>
  );
}

function IconEvents() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconMegaphone() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function IconTrendingUp() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

type FormDef = {
  label: string;
  description: string;
  href: string;
  iconBg: string;
  iconColor: string;
  Icon: React.ComponentType;
};

type SectionDef = {
  title: string;
  description: string;
  items: FormDef[];
};

const SECTIONS: SectionDef[] = [
  {
    title: 'HR & Workforce',
    description: 'People, leave, and organizational forms',
    items: [
      {
        label: 'Add Employee',
        description: 'Onboard a new employee record',
        href: '/dashboard/employees/add',
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-600',
        Icon: IconUsers,
      },
      {
        label: 'Leave Request',
        description: 'Submit a new leave application',
        href: '/dashboard/requests/add',
        iconBg: 'bg-sky-50',
        iconColor: 'text-sky-600',
        Icon: IconInbox,
      },
    ],
  },
  {
    title: 'Time & Attendance',
    description: 'Track time worked and attendance events',
    items: [
      {
        label: 'Add Timesheet',
        description: 'Log hours against tasks & projects',
        href: '/dashboard/timesheets/add',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        Icon: IconClock,
      },
      {
        label: 'Attendance',
        description: 'Record check-in / check-out',
        href: '/dashboard/attendance',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        Icon: IconCalendarCheck,
      },
    ],
  },
  {
    title: 'Expenses & Finance',
    description: 'Expenses, invoices, and accounting entries',
    items: [
      {
        label: 'Add Expense',
        description: 'Submit a new expense claim',
        href: '/dashboard/expenses/add',
        iconBg: 'bg-orange-50',
        iconColor: 'text-orange-600',
        Icon: IconRupee,
      },
      {
        label: 'Add Invoice',
        description: 'Create a new customer invoice',
        href: '/dashboard/invoices/add',
        iconBg: 'bg-violet-50',
        iconColor: 'text-violet-600',
        Icon: IconFileText,
      },
      {
        label: 'Add Quote',
        description: 'Draft a new sales quote',
        href: '/dashboard/quotes/add',
        iconBg: 'bg-teal-50',
        iconColor: 'text-teal-600',
        Icon: IconFileText,
      },
      {
        label: 'Add Ledger Entry',
        description: 'Post a manual ledger entry',
        href: '/dashboard/ledger-entries/add',
        iconBg: 'bg-slate-100',
        iconColor: 'text-slate-700',
        Icon: IconBook,
      },
    ],
  },
  {
    title: 'Sales & CRM',
    description: 'Leads, deals, contacts, and campaigns',
    items: [
      {
        label: 'Add Lead',
        description: 'Capture a new sales lead',
        href: '/dashboard/leads/add',
        iconBg: 'bg-rose-50',
        iconColor: 'text-rose-600',
        Icon: IconLeads,
      },
      {
        label: 'Add Deal',
        description: 'Create a new pipeline deal',
        href: '/dashboard/deals/add',
        iconBg: 'bg-pink-50',
        iconColor: 'text-pink-600',
        Icon: IconBriefcase,
      },
      {
        label: 'Add Contact',
        description: 'Add a person or organization contact',
        href: '/dashboard/contacts/add',
        iconBg: 'bg-cyan-50',
        iconColor: 'text-cyan-600',
        Icon: IconContacts,
      },
      {
        label: 'Add Campaign Lead',
        description: 'Capture a lead from a marketing campaign',
        href: '/dashboard/campaign-leads/add',
        iconBg: 'bg-fuchsia-50',
        iconColor: 'text-fuchsia-600',
        Icon: IconTrendingUp,
      },
      {
        label: 'Add Marketing Campaign',
        description: 'Plan and define a marketing campaign',
        href: '/dashboard/marketing-campaigns/add',
        iconBg: 'bg-purple-50',
        iconColor: 'text-purple-600',
        Icon: IconMegaphone,
      },
      {
        label: 'Add Event',
        description: 'Schedule an event or meeting',
        href: '/dashboard/events/add',
        iconBg: 'bg-lime-50',
        iconColor: 'text-lime-700',
        Icon: IconEvents,
      },
    ],
  },
  {
    title: 'Projects & Tasks',
    description: 'Deliver work through projects and tasks',
    items: [
      {
        label: 'Add Project',
        description: 'Initiate a new client or internal project',
        href: '/dashboard/projects/add',
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        Icon: IconFolder,
      },
      {
        label: 'Add Task',
        description: 'Create an actionable work item',
        href: '/dashboard/tasks/add',
        iconBg: 'bg-green-50',
        iconColor: 'text-green-600',
        Icon: IconCheck,
      },
    ],
  },
  {
    title: 'Operations',
    description: 'Tickets and other operational forms',
    items: [
      {
        label: 'Add Ticket',
        description: 'Log a support or operations ticket',
        href: '/dashboard/tickets/add',
        iconBg: 'bg-red-50',
        iconColor: 'text-red-600',
        Icon: IconTag,
      },
    ],
  },
];

const ALL_ITEM_COUNT = SECTIONS.reduce((n, s) => n + s.items.length, 0);

export default function DynamicFormsDirectoryPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [search]);

  const totalShowing = filteredSections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/dashboard/forms')}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-orange-600"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Forms
          </button>
          <span className="text-slate-300">/</span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Dynamic Forms</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Directory of application forms — open a form to submit
            </p>
          </div>
        </div>
        <div className="relative">
          <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search forms…"
            className="pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-orange-400 w-56"
          />
        </div>
      </div>

      {filteredSections.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-20 text-slate-400">
          <svg viewBox="0 0 24 24" className="w-16 h-16 mb-4 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" />
          </svg>
          <p className="text-sm font-medium text-slate-500">No forms match your search</p>
          <p className="text-xs text-slate-400 mt-1">Try a different keyword.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredSections.map((section) => (
            <section key={section.title}>
              <div className="mb-3">
                <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => {
                  const { Icon } = item;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group block bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-orange-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-11 h-11 shrink-0 rounded-lg ${item.iconBg} ${item.iconColor} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                          <Icon />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
                            {item.label}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 mt-0.5 text-slate-300 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-5 text-xs text-slate-400">
        Showing {totalShowing} of {ALL_ITEM_COUNT} form{ALL_ITEM_COUNT === 1 ? '' : 's'}
      </p>
    </div>
  );
}
