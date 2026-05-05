'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDeals, deleteDeal, Deal } from '../../../src/api/dealsApi';
import TableActions from '@/components/common/TableActions';
import { formatInrCurrency } from '@/utils/formatCurrency';

const PIPELINE_COLORS: Record<string, string> = {
  Marketing: 'bg-purple-100 text-purple-700',
  Service:   'bg-red-100 text-red-700',
  Sales:     'bg-teal-100 text-teal-700',
};

function formatValue(v: number) {
  return formatInrCurrency(v, 2);
}

function formatShortDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function DealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'All' | 'Open' | 'Won' | 'Lost'>('All');
  const now = useMemo(() => new Date().getTime(), []);

  useEffect(() => {
    getDeals()
      .then(setDeals)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this deal?')) return;
    await deleteDeal(id);
    setDeals((prev) => prev.filter((deal) => deal.id !== id));
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

  const dealStats = useMemo(() => {
    const openDeals = deals.filter((deal) => deal.stage !== 'WON' && deal.stage !== 'LOST');
    const wonDeals = deals.filter((deal) => deal.stage === 'WON');
    const lostDeals = deals.filter((deal) => deal.stage === 'LOST');
    const pipelineValue = openDeals.reduce((sum, deal) => sum + deal.value, 0);
    const wonValue = wonDeals.reduce((sum, deal) => sum + deal.value, 0);
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
      won: wonDeals.length,
      lost: lostDeals.length,
      pipelineValue,
      wonValue,
      weightedForecast,
      closingSoon: closingSoon.length,
    };
  }, [deals, now]);

  const closingSoonDeals = useMemo(
    () => filtered.filter((deal) => deal.stage !== 'WON' && deal.stage !== 'LOST' && deal.closeDate).slice(0, 5),
    [filtered],
  );

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Sales Cockpit</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Track revenue by stage, not just by row</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              A Salesforce-style sales workspace with pipeline value, forecast signal, and high-priority closing deals surfaced up front.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push('/dashboard/deals/add')}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-orange-200 transition-colors hover:bg-orange-600"
            >
              <span className="text-base leading-none">+</span>
              New Deal
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/deals/pipeline')}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Pipeline View
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/deals/stages')}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Stages View
            </button>
            <TableActions moduleKey="deals" rows={filtered} onRefresh={() => getDeals().then(setDeals)} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search deals</label>
            <input
              type="text"
              placeholder="Search by deal, lead, owner, or contact"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div className="text-sm text-slate-500 lg:text-right">Filter by stage and keep the highest-value opportunities visible.</div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pipeline value</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{formatValue(dealStats.pipelineValue)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weighted forecast</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{formatValue(dealStats.weightedForecast)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Won value</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{formatValue(dealStats.wonValue)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Closing soon</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{dealStats.closingSoon}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['All', 'Open', 'Won', 'Lost'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStageFilter(filter)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                stageFilter === filter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-400">Loading deals…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 text-left font-semibold">Deal</th>
                    <th className="px-4 py-3 text-left font-semibold">Value</th>
                    <th className="px-4 py-3 text-left font-semibold">Stage</th>
                    <th className="px-4 py-3 text-left font-semibold">Forecast</th>
                    <th className="px-4 py-3 text-left font-semibold">Close Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Owner</th>
                    <th className="px-4 py-3 text-left font-semibold">Pipeline</th>
                    <th className="px-4 py-3 text-left font-semibold w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-sm text-slate-400">
                        No deals found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((deal) => (
                      <tr key={deal.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{deal.title}</p>
                            <p className="mt-1 text-xs text-slate-500">Lead: {deal.lead?.name ?? '—'}{deal.contact ? ` · ${deal.contact}` : ''}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">{formatValue(deal.value)}</td>
                        <td className="px-4 py-4 capitalize text-slate-600">{deal.stage.charAt(0) + deal.stage.slice(1).toLowerCase()}</td>
                        <td className="px-4 py-4 text-slate-600">{deal.probability != null ? `${deal.probability.toFixed(2)}%` : '—'}</td>
                        <td className="px-4 py-4 text-slate-600">{formatShortDate(deal.closeDate)}</td>
                        <td className="px-4 py-4 text-slate-600">{deal.owner ?? '—'}</td>
                        <td className="px-4 py-4">
                          {deal.pipeline ? (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${PIPELINE_COLORS[deal.pipeline] ?? 'bg-slate-100 text-slate-700'}`}>
                              {deal.pipeline}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
                              className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDelete(deal.id)}
                              className="text-xs font-medium text-red-500 transition-colors hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Sales signals</p>
            <p className="text-xs text-slate-500">What leadership usually cares about first</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open deals</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{dealStats.open}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Won deals</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{dealStats.won}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lost deals</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{dealStats.lost}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Closing soon</p>
            <p className="text-xs text-slate-500">Next 14 days</p>
            <div className="mt-4 space-y-3">
              {closingSoonDeals.length === 0 ? (
                <p className="text-sm text-slate-400">No deals closing soon.</p>
              ) : (
                closingSoonDeals.map((deal) => (
                  <div key={deal.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{deal.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{deal.lead?.name ?? 'No lead linked'}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs font-medium text-slate-500">{formatShortDate(deal.closeDate)}</span>
                    </div>
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
