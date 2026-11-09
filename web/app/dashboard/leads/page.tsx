'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Eye, MoreHorizontal, Pencil, Search, Trash2, UserRound } from 'lucide-react';
import { useLeads, removeLead } from '@/hooks/useLeads';
import { reassignLeadOwner } from '@/api/leadsApi';
import type { LeadScope } from '@/api/leadsApi';
import { getEmployees } from '@/api/employeesApi';
import type { Employee } from '@/api/employeesApi';
import { useStableNow } from '@/hooks/useStableNow';
import TableActions from '@/components/common/TableActions';
import { AddEntryButton } from '@/components/common/AddEntryButton';

const SOURCE_STYLES: Record<string, string> = {
  Direct:        'bg-purple-600 text-white',
  Website:       'bg-orange-500 text-white',
  Event:         'bg-green-500 text-white',
  Referral:      'bg-blue-500 text-white',
  'Social Media': 'bg-pink-500 text-white',
};

const STATUS_FILTERS = ['All', 'New', 'Contacted', 'Qualified', 'Proposal Sent', 'Closed Won', 'Closed Lost'] as const;
const PAGE_SIZE = 10;

function fmtDate(d?: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

function fmtRelativeDate(d: string | null | undefined, currentTime: number) {
  if (!d) return 'No follow-up';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return 'No follow-up';

  const diffDays = Math.floor((dt.getTime() - currentTime) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays}d`;
}

function getStatusBadgeClass(status?: string | null) {
  const normalized = (status ?? '').toLowerCase();
  if (normalized.includes('won')) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (normalized.includes('lost')) return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
  if (normalized.includes('proposal') || normalized.includes('qualified')) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  if (normalized.includes('contacted')) return 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200';
  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

type LeadRowActionsProps = {
  leadId: number;
  leadName: string;
  owners: Employee[];
  saving: boolean;
  deleting: boolean;
  onOwnerChange: (ownerUserId: number | null) => void;
  onDelete: () => void;
};

function LeadRowActions({ leadId, leadName, owners, saving, deleting, onOwnerChange, onDelete }: LeadRowActionsProps) {
  const itemClass = 'flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50 focus:bg-slate-50';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" disabled={saving || deleting} aria-label={`Actions for ${leadName}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40">
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <DropdownMenu.Item asChild className={itemClass}><Link href={`/dashboard/leads/${leadId}`}><Eye size={15} aria-hidden="true" />Open lead</Link></DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}><Link href={`/dashboard/leads/edit/${leadId}`}><Pencil size={15} aria-hidden="true" />Edit lead</Link></DropdownMenu.Item>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={`${itemClass} justify-between`}><span className="flex items-center gap-2.5"><UserRound size={15} aria-hidden="true" />Assign owner</span><span className="text-slate-400">›</span></DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent sideOffset={6} className="z-50 max-h-72 min-w-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <DropdownMenu.Item onSelect={() => onOwnerChange(null)} className={itemClass}>Unassigned</DropdownMenu.Item>
                {owners.filter((employee) => employee.user?.id).map((employee) => <DropdownMenu.Item key={employee.user!.id} onSelect={() => onOwnerChange(employee.user!.id)} className={itemClass}>{employee.name}</DropdownMenu.Item>)}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
          <DropdownMenu.Item onSelect={onDelete} className={`${itemClass} text-rose-700 hover:bg-rose-50 focus:bg-rose-50`}><Trash2 size={15} aria-hidden="true" />Delete lead</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default function LeadsReportPage() {
  const router = useRouter();
  const [ownerScope, setOwnerScope] = useState<LeadScope | undefined>();
  const { leads, loading, error, refetch } = useLeads(ownerScope);
  const currentTime = useStableNow();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('All');
  const [page, setPage] = useState(1);
  const [owners, setOwners] = useState<Employee[]>([]);
  const [savingOwner, setSavingOwner] = useState<number | null>(null);

  useEffect(() => {
    getEmployees().then(setOwners).catch(() => setOwners([]));
  }, []);

  async function handleDelete(id: number) {
    if (!confirm('Delete this lead?')) return;
    setDeleting(id);
    try { await removeLead(id); refetch(); } finally { setDeleting(null); }
  }

  async function handleOwnerChange(id: number, ownerUserId: number | null) {
    setSavingOwner(id);
    try { await reassignLeadOwner(id, ownerUserId); await refetch(); } finally { setSavingOwner(null); }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l) => {
      const matchesSearch =
        l.name.toLowerCase().includes(q) ||
        (l.source ?? '').toLowerCase().includes(q) ||
        (l.status ?? '').toLowerCase().includes(q) ||
        (l.leadOwner ?? '').toLowerCase().includes(q) ||
        (l.assignedTo ?? '').toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'All' || (l.status ?? '').toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  useEffect(() => setPage(1), [search, statusFilter, ownerScope]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleLeads = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const leadStats = useMemo(() => {
    const openLeads = leads.filter((lead) => {
      const normalized = (lead.status ?? '').toLowerCase();
      return !normalized.includes('won') && !normalized.includes('lost');
    });
    const dueFollowUps = leads.filter((lead) => {
      if (!lead.nextFollowUp) return false;
      const followUpDate = new Date(lead.nextFollowUp).getTime();
      return !Number.isNaN(followUpDate) && followUpDate <= currentTime;
    });
    return {
      total: leads.length,
      open: openLeads.length,
      dueFollowUps: dueFollowUps.length,
    };
  }, [leads, currentTime]);

  return (
    <main className="mx-auto w-full max-w-360 space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">CRM</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Leads</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
            <span>{leadStats.total} total</span><span aria-hidden="true" className="text-slate-300">·</span>
            <span>{leadStats.open} open</span><span aria-hidden="true" className="text-slate-300">·</span>
            <span>{leadStats.dueFollowUps} follow-ups due</span>
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <TableActions moduleKey="leads" rows={filtered} onRefresh={refetch} />
          <AddEntryButton label="Add lead" onClick={() => router.push('/dashboard/leads/add')} />
        </div>
      </header>

      <section aria-label="Lead filters" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <span className="sr-only">Search leads</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads, sources or owners" className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filter by status" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
            {STATUS_FILTERS.map((filter) => <option key={filter} value={filter}>{filter === 'All' ? 'All statuses' : filter}</option>)}
          </select>
          <select value={ownerScope ?? 'all'} onChange={(event) => setOwnerScope(event.target.value === 'all' ? undefined : event.target.value as LeadScope)} aria-label="Filter by owner" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
            <option value="all">All owners</option><option value="mine">My leads</option><option value="my_team">My team</option><option value="unassigned">Unassigned</option>
          </select>
          <span className="hidden text-sm text-slate-500 sm:inline">{filtered.length} results</span>
        </div>
      </section>

      <section aria-label="Leads" className="border-t border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <svg className="w-16 h-16 text-slate-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-slate-500 font-medium">No leads yet</p>
            <Link href="/dashboard/leads/add" className="mt-3 text-orange-500 hover:text-orange-600 text-sm font-medium">Add your first lead →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead>
                <tr>
                  <th className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lead</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Source</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Follow-up</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Owner</th>
                  <th className="w-12 py-3 pl-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleLeads.map((lead) => (
                  <tr key={lead.id} className="group transition-colors hover:bg-slate-50/70">
                    <td className="py-4 pr-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700">
                          {getInitials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/dashboard/leads/${lead.id}`} className="text-sm font-medium text-slate-900 decoration-slate-300 underline-offset-4 hover:text-orange-700 hover:underline">{lead.name}</Link>
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-500">{lead.notes ?? `Score ${lead.leadScore ?? '—'}`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(lead.status)}`}>
                        {lead.status ?? 'New'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {lead.source ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${SOURCE_STYLES[lead.source] ?? 'bg-slate-100 text-slate-700'}`}>
                          {lead.source}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm text-slate-600">{fmtDate(lead.nextFollowUp)}</p>
                        <p className="text-xs text-slate-400">{fmtRelativeDate(lead.nextFollowUp, currentTime)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{lead.leadOwner ?? lead.assignedTo ?? 'Unassigned'}</td>
                    <td className="py-2 pl-4 text-right"><LeadRowActions leadId={lead.id} leadName={lead.name} owners={owners} saving={savingOwner === lead.id} deleting={deleting === lead.id} onOwnerChange={(ownerUserId) => void handleOwnerChange(lead.id, ownerUserId)} onDelete={() => void handleDelete(lead.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
              <div className="flex items-center justify-between gap-3">
                <span>Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {leads.length}</span>
                {filtered.length > PAGE_SIZE && (
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                    <span className="text-slate-500">{page} / {pageCount}</span>
                    <button type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
