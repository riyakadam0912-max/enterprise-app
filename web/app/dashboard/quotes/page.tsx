'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuotes, useDeleteQuote, useConvertQuoteToInvoice } from '@/hooks/useQuotes';
import TableActions from '@/components/common/TableActions';
import {
  QUOTE_STATUS_STYLES,
  deriveQuoteStatus,
  daysBetween,
  daysUntil,
  formatDate,
  formatInr,
} from '@/utils/finance';

const FILTERS = ['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'EXPIRED'] as const;

function StatusBadge({ status }: { status: string }) {
  const cls = QUOTE_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

export default function QuotesPage() {
  const router = useRouter();
  const { data: quotes, loading, error, refetch } = useQuotes();
  const { remove } = useDeleteQuote();
  const { convert } = useConvertQuoteToInvoice();
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]>('ALL');

  const quoteStats = useMemo(() => {
    const normalized = quotes.map((quote) => ({
      quote,
      status: deriveQuoteStatus(quote.status, quote.validTill),
    }));

    return {
      total: normalized.length,
      sent: normalized.filter((entry) => entry.status === 'SENT').length,
      accepted: normalized.filter((entry) => entry.status === 'ACCEPTED').length,
      rejected: normalized.filter((entry) => entry.status === 'REJECTED').length,
      expired: normalized.filter((entry) => entry.status === 'EXPIRED').length,
      converted: normalized.filter((entry) => entry.status === 'CONVERTED').length,
      totalValue: normalized.reduce((sum, entry) => sum + (entry.quote.total ?? 0), 0),
    };
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return quotes.filter((quote) => {
      const derivedStatus = deriveQuoteStatus(quote.status, quote.validTill);
      const matchesSearch =
        quote.id.toString().includes(query) ||
        (quote.contact?.contactName ?? '').toLowerCase().includes(query) ||
        (quote.contact?.company ?? '').toLowerCase().includes(query) ||
        (quote.deal?.title ?? '').toLowerCase().includes(query) ||
        derivedStatus.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || derivedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [quotes, search, statusFilter]);

  async function handleDelete(id: number) {
    if (!confirm('Delete this quote?')) return;
    setActionLoading(id);
    try {
      await remove(id);
      await refetch();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleConvert(id: number) {
    if (!confirm('Convert this quote to an invoice?')) return;
    setActionLoading(id);
    try {
      await convert(id);
      await refetch();
      router.push('/dashboard/invoices');
    } catch {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Sales workflow</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Quotes</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Track proposals by status, expiry, and value so the team can send, convert, or close them without leaving the sales workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/quotes/add"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-orange-200 transition-colors hover:bg-orange-600"
            >
              <span className="text-base leading-none">+</span>
              New Quote
            </Link>
            <TableActions moduleKey="quotes" rows={filteredQuotes} onRefresh={refetch} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {[
            { label: 'Total quotes', value: quoteStats.total },
            { label: 'Sent', value: quoteStats.sent },
            { label: 'Accepted', value: quoteStats.accepted },
            { label: 'Rejected', value: quoteStats.rejected },
            { label: 'Expired', value: quoteStats.expired },
            { label: 'Quoted value', value: formatInr(quoteStats.totalValue) },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative max-w-xl flex-1">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search quotes, clients, deals, status..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-orange-400"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === filter ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {filter === 'ALL' ? 'All' : filter.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading quotes…</div>
        ) : error ? (
          <div className="py-20 text-center text-sm text-red-500">{error}</div>
        ) : filteredQuotes.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-slate-400">No quotes match the current filters.</p>
            <Link href="/dashboard/quotes/add" className="mt-3 inline-block text-sm text-orange-500 hover:underline">
              Create your first quote →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Quote</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Client</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Deal</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Validity</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Age</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.map((quote) => {
                  const status = deriveQuoteStatus(quote.status, quote.validTill);
                  const ageDays = daysBetween(quote.createdAt) ?? 0;
                  const validityDays = daysUntil(quote.validTill);
                  const isConverted = status === 'CONVERTED';

                  return (
                    <tr key={quote.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">Quote #{quote.id}</div>
                        <div className="text-xs text-slate-500">{formatDate(quote.createdAt)}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <div className="font-medium">{quote.contact?.contactName ?? 'Unassigned client'}</div>
                        <div className="text-xs text-slate-500">{quote.contact?.company ?? 'No company'}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <div className="font-medium">{quote.deal?.title ?? '—'}</div>
                        <div className="text-xs text-slate-500">{quote.deal?.stage ?? 'No deal stage'}</div>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-900">{formatInr(quote.total ?? 0)}</td>
                      <td className="px-5 py-4"><StatusBadge status={status} /></td>
                      <td className="px-5 py-4 text-slate-600">
                        <div>{formatDate(quote.validTill)}</div>
                        <div className="text-xs text-slate-400">
                          {validityDays === null ? 'No expiry set' : validityDays >= 0 ? `${validityDays} days left` : `${Math.abs(validityDays)} days expired`}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <div>{ageDays} days</div>
                        <div className="text-xs text-slate-400">Since created</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/dashboard/quotes/${quote.id}`}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            Open
                          </Link>
                          <Link
                            href={`/dashboard/quotes/add?editId=${quote.id}`}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                          >
                            Edit
                          </Link>
                          {!isConverted ? (
                            <button
                              type="button"
                              onClick={() => handleConvert(quote.id)}
                              disabled={actionLoading === quote.id}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              Convert
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDelete(quote.id)}
                            disabled={actionLoading === quote.id}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
