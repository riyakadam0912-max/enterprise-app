'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLeads, removeLead } from '@/hooks/useLeads';
import { useStableNow } from '@/hooks/useStableNow';
import TableActions from '@/components/common/TableActions';

const SOURCE_STYLES: Record<string, string> = {
  Direct:        'bg-purple-600 text-white',
  Website:       'bg-orange-500 text-white',
  Event:         'bg-green-500 text-white',
  Referral:      'bg-blue-500 text-white',
  'Social Media': 'bg-pink-500 text-white',
};

const STATUS_FILTERS = ['All', 'New', 'Contacted', 'Qualified', 'Proposal Sent', 'Closed Won', 'Closed Lost'] as const;

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

export default function LeadsReportPage() {
  const router = useRouter();
  const { leads, loading, error, refetch } = useLeads();
  const currentTime = useStableNow();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('All');

  async function handleDelete(id: number) {
    if (!confirm('Delete this lead?')) return;
    setDeleting(id);
    try { await removeLead(id); refetch(); } finally { setDeleting(null); }
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
    const qualified = leads.filter((lead) => (lead.status ?? '').toLowerCase().includes('qualified'));
    const won = leads.filter((lead) => (lead.status ?? '').toLowerCase().includes('won'));

    return {
      total: leads.length,
      open: openLeads.length,
      dueFollowUps: dueFollowUps.length,
      qualified: qualified.length,
      won: won.length,
    };
  }, [leads, currentTime]);

  const followUpQueue = useMemo(
    () =>
      [...filtered]
        .filter((lead) => Boolean(lead.nextFollowUp))
        .sort((a, b) => new Date(a.nextFollowUp ?? 0).getTime() - new Date(b.nextFollowUp ?? 0).getTime())
        .slice(0, 5),
    [filtered],
  );

  const hotLeads = useMemo(
    () => [...filtered].filter((lead) => (lead.leadScore ?? 0) >= 80).slice(0, 4),
    [filtered],
  );

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Lead Command Center</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Qualify, prioritize, and convert faster</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              A CRM-style lead workspace that shows the next follow-up, pipeline state, and high-value opportunities in one glance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push('/dashboard/leads/add')}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-orange-200 transition-colors hover:bg-orange-600"
            >
              <span className="text-base leading-none">+</span>
              New Lead
            </button>
            <TableActions moduleKey="leads" rows={filtered} onRefresh={refetch} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search leads</label>
            <input
              type="text"
              placeholder="Search by name, source, owner, or note"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div className="text-sm text-slate-500 lg:text-right">Use the chips below to narrow the queue.</div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total leads</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{leadStats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open pipeline</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{leadStats.open}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-ups due</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{leadStats.dueFollowUps}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qualified</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{leadStats.qualified}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Won</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{leadStats.won}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === filter
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Lead','Status','Source','Owner','Next Follow-up','Score','Actions'].map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700">
                          {getInitials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {lead.leadOwner ?? 'Unassigned'}{lead.assignedTo ? ` · ${lead.assignedTo}` : ''}
                          </p>
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-400">{lead.notes ?? 'No notes yet'}</p>
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
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{lead.assignedTo ?? lead.leadOwner ?? '—'}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm text-slate-600">{fmtDate(lead.nextFollowUp)}</p>
                        <p className="text-xs text-slate-400">{fmtRelativeDate(lead.nextFollowUp, currentTime)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{lead.leadScore ?? '—'}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/leads/${lead.id}`} className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700">View</Link>
                        <Link href={`/dashboard/leads/edit/${lead.id}`} className="text-xs font-medium text-slate-600 transition-colors hover:text-orange-600">Edit</Link>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          disabled={deleting === lead.id}
                          className="text-xs font-medium text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
                        >
                          {deleting === lead.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
              Showing {filtered.length} of {leads.length}
            </div>
          </div>
        )}
      </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Follow-up queue</p>
                <p className="text-xs text-slate-500">Leads needing attention next</p>
              </div>
              <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">{followUpQueue.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {followUpQueue.length === 0 ? (
                <p className="text-sm text-slate-400">No follow-ups scheduled.</p>
              ) : (
                followUpQueue.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/dashboard/leads/${lead.id}`}
                    className="block rounded-2xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{lead.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{lead.status ?? 'New'} · {lead.source ?? 'No source'}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs font-medium text-slate-500">{fmtRelativeDate(lead.nextFollowUp, currentTime)}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">High-score leads</p>
            <p className="text-xs text-slate-500">Likely to convert first</p>
            <div className="mt-4 space-y-3">
              {hotLeads.length === 0 ? (
                <p className="text-sm text-slate-400">No high-score leads yet.</p>
              ) : (
                hotLeads.map((lead) => (
                  <div key={lead.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{lead.name}</p>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {lead.leadScore ?? 0}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{lead.assignedTo ?? lead.leadOwner ?? 'Unassigned'}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
