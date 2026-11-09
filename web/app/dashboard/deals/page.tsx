'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { BarChart3, Kanban, MoreHorizontal, Pencil, Search, Trash2, UserRound } from 'lucide-react';
import { getDeals, deleteDeal, reassignDealOwner } from '../../../src/api/dealsApi';
import type { Deal, DealScope } from '../../../src/api/dealsApi';
import { getEmployees } from '../../../src/api/employeesApi';
import type { Employee } from '../../../src/api/employeesApi';
import TableActions from '@/components/common/TableActions';
import { formatInrCurrency } from '@/utils/formatCurrency';
import { reportError } from '@/lib/error-handling';
import { AddEntryButton } from '@/components/common/AddEntryButton';

const PAGE_SIZE = 10;

function formatValue(v: number) {
  return formatInrCurrency(v, 2);
}

function formatShortDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

type DealRowActionsProps = {
  deal: Deal;
  owners: Employee[];
  saving: boolean;
  onOwnerChange: (ownerUserId: number | null) => void;
  onDelete: () => void;
};

function DealRowActions({ deal, owners, saving, onOwnerChange, onDelete }: DealRowActionsProps) {
  const itemClass = 'flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50 focus:bg-slate-50';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" disabled={saving} aria-label={`Actions for ${deal.title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40">
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href={`/dashboard/deals/${deal.id}`}><BarChart3 size={15} aria-hidden="true" />Open deal</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href={`/dashboard/deals/edit/${deal.id}`}><Pencil size={15} aria-hidden="true" />Edit deal</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={`${itemClass} justify-between`}>
              <span className="flex items-center gap-2.5"><UserRound size={15} aria-hidden="true" />Assign owner</span><span className="text-slate-400">›</span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent sideOffset={6} className="z-50 max-h-72 min-w-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <DropdownMenu.Item onSelect={() => onOwnerChange(null)} className={itemClass}>Unassigned</DropdownMenu.Item>
                {owners.filter((employee) => employee.user?.id).map((employee) => (
                  <DropdownMenu.Item key={employee.user!.id} onSelect={() => onOwnerChange(employee.user!.id)} className={itemClass}>{employee.name}</DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
          <DropdownMenu.Item onSelect={onDelete} className={`${itemClass} text-rose-700 hover:bg-rose-50 focus:bg-rose-50`}><Trash2 size={15} aria-hidden="true" />Delete deal</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default function DealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ownerScope, setOwnerScope] = useState<DealScope | undefined>();
  const [stageFilter, setStageFilter] = useState<'All' | 'Open' | 'Won' | 'Lost'>('All');
  const [page, setPage] = useState(1);
  const [owners, setOwners] = useState<Employee[]>([]);
  const [savingOwner, setSavingOwner] = useState<number | null>(null);
  const now = useMemo(() => new Date().getTime(), []);

  useEffect(() => {
    async function loadDeals() {
      try {
        setDeals(await getDeals(ownerScope));
      } catch (error) {
        reportError(error, 'Unable to load deals');
      } finally {
        setLoading(false);
      }
    }

    loadDeals();
  }, [ownerScope]);

  useEffect(() => {
    getEmployees().then(setOwners).catch(() => setOwners([]));
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this deal?')) return;
    await deleteDeal(id);
    setDeals((prev) => prev.filter((deal) => deal.id !== id));
  };

  const handleOwnerChange = async (id: number, ownerUserId: number | null) => {
    setSavingOwner(id);
    try { await reassignDealOwner(id, ownerUserId); setDeals(await getDeals(ownerScope)); } finally { setSavingOwner(null); }
  };

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return deals.filter((deal) => {
      const matchesSearch =
        deal.title.toLowerCase().includes(query) ||
        (deal.lead?.name ?? '').toLowerCase().includes(query) ||
        (deal.owner ?? '').toLowerCase().includes(query) ||
        (deal.contact ?? '').toLowerCase().includes(query);

      const normalizedStage = deal.stage.toUpperCase();
      const matchesStage =
        stageFilter === 'All' ||
        (stageFilter === 'Open' && normalizedStage !== 'WON' && normalizedStage !== 'LOST') ||
        (stageFilter === 'Won' && normalizedStage === 'WON') ||
        (stageFilter === 'Lost' && normalizedStage === 'LOST');

      return matchesSearch && matchesStage;
    });
  }, [deals, search, stageFilter]);

  useEffect(() => setPage(1), [search, stageFilter, ownerScope]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleDeals = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const dealStats = useMemo(() => {
    const openDeals = deals.filter((deal) => deal.stage !== 'WON' && deal.stage !== 'LOST');
    const pipelineValue = openDeals.reduce((sum, deal) => sum + deal.value, 0);
    const weightedForecast = openDeals.reduce((sum, deal) => sum + deal.value * (deal.probability ?? 0), 0);
    const closingSoon = openDeals.filter((deal) => {
      if (!deal.closeDate) return false;
      const closeDate = new Date(deal.closeDate).getTime();
      const daysAway = (closeDate - now) / (1000 * 60 * 60 * 24);
      return !Number.isNaN(closeDate) && daysAway <= 14;
    });

    return {
      total: deals.length,
      open: openDeals.length,
      pipelineValue,
      weightedForecast,
      closingSoon: closingSoon.length,
    };
  }, [deals, now]);

  return (
    <main className="mx-auto w-full max-w-360 space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Sales</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Deals</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
            <span>{dealStats.open} open</span><span aria-hidden="true" className="text-slate-300">·</span>
            <span>{formatValue(dealStats.pipelineValue)} pipeline</span><span aria-hidden="true" className="text-slate-300">·</span>
            <span>{formatValue(dealStats.weightedForecast)} forecast</span>
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button type="button" onClick={() => router.push('/dashboard/deals/pipeline')} title="Pipeline view" aria-label="Pipeline view" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><Kanban size={17} aria-hidden="true" /></button>
          <TableActions moduleKey="deals" rows={filtered} onRefresh={() => getDeals(ownerScope).then(setDeals)} />
          <AddEntryButton label="Add deal" onClick={() => router.push('/dashboard/deals/add')} />
        </div>
      </header>

      <section aria-label="Deal filters" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <span className="sr-only">Search deals</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search deals, leads or contacts" className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as typeof stageFilter)} aria-label="Filter by stage" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
            <option value="All">All stages</option><option value="Open">Open</option><option value="Won">Won</option><option value="Lost">Lost</option>
          </select>
          <select value={ownerScope ?? 'all'} onChange={(event) => setOwnerScope(event.target.value === 'all' ? undefined : event.target.value as DealScope)} aria-label="Filter by owner" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
            <option value="all">All owners</option><option value="mine">My deals</option><option value="my_team">My team</option><option value="unassigned">Unassigned</option>
          </select>
          <span className="hidden text-sm text-slate-500 sm:inline">{filtered.length} results</span>
        </div>
      </section>

      <section aria-label="Deals" className="border-t border-slate-200">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-400">Loading deals…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-190 text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-3 pr-4">Deal</th>
                    <th className="px-4 py-3 text-right">Value</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Close date</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="w-12 py-3 pl-4"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-sm text-slate-400">
                        No deals found
                      </td>
                    </tr>
                  ) : (
                    visibleDeals.map((deal) => (
                      <tr key={deal.id} className="group transition-colors hover:bg-slate-50/70">
                        <td className="py-4 pr-4">
                          <div>
                            <Link href={`/dashboard/deals/${deal.id}`} className="text-sm font-medium text-slate-900 decoration-slate-300 underline-offset-4 hover:text-orange-700 hover:underline">{deal.title}</Link>
                            <p className="mt-1 text-xs text-slate-500">Lead: {deal.lead?.name ?? '—'}{deal.contact ? ` · ${deal.contact}` : ''}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-medium tabular-nums text-slate-900">{formatValue(deal.value)}</td>
                        <td className="px-4 py-4"><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">{deal.stage.toLowerCase()}</span></td>
                        <td className="px-4 py-4 text-slate-600">{formatShortDate(deal.closeDate)}</td>
                        <td className="px-4 py-4 text-slate-600">{deal.owner ?? 'Unassigned'}</td>
                        <td className="py-2 pl-4 text-right">
                          <DealRowActions deal={deal} owners={owners} saving={savingOwner === deal.id} onOwnerChange={(ownerUserId) => void handleOwnerChange(deal.id, ownerUserId)} onDelete={() => void handleDelete(deal.id)} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {filtered.length > 0 && (
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
                  <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {deals.length}</span>
                  {filtered.length > PAGE_SIZE && (
                    <div className="flex items-center gap-2">
                      <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                      <span className="text-slate-500">{page} / {pageCount}</span>
                      <button type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
      </section>
    </main>
  );
}
