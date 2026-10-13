'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ArrowRightLeft,
  CalendarDays,
  FilePlus2,
  FileText,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { useQuotes, useDeleteQuote, useConvertQuoteToInvoice } from '@/hooks/useQuotes';
import TableActions from '@/components/common/TableActions';
import {
  QUOTE_STATUS_STYLES,
  deriveQuoteStatus,
  daysUntil,
  formatDate,
  formatInr,
} from '@/utils/finance';

const FILTERS = ['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'EXPIRED'] as const;

type QuoteRowActionsProps = {
  quoteId: number;
  isConverted: boolean;
  isLoading: boolean;
  onConvert: () => void;
  onDelete: () => void;
};

function QuoteRowActions({
  quoteId,
  isConverted,
  isLoading,
  onConvert,
  onDelete,
}: QuoteRowActionsProps) {
  const menuItemClass = 'flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50 focus:bg-slate-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-40';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Actions for quote ${quoteId}`}
          title="Quote actions"
          disabled={isLoading}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <DropdownMenu.Item asChild className={menuItemClass}>
            <Link href={`/dashboard/quotes/${quoteId}`}>
              <FileText size={15} aria-hidden="true" />
              Open quote
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={menuItemClass}>
            <Link href={`/dashboard/quotes/add?editId=${quoteId}`}>
              <Pencil size={15} aria-hidden="true" />
              Edit quote
            </Link>
          </DropdownMenu.Item>
          {!isConverted ? (
            <DropdownMenu.Item disabled={isLoading} onSelect={onConvert} className={menuItemClass}>
              <ArrowRightLeft size={15} aria-hidden="true" />
              Convert to invoice
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
          <DropdownMenu.Item disabled={isLoading} onSelect={onDelete} className={`${menuItemClass} text-rose-700 hover:bg-rose-50 focus:bg-rose-50`}>
            <Trash2 size={15} aria-hidden="true" />
            Delete quote
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

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

  const quoteStats = useMemo(() => ({
    total: quotes.length,
    awaitingResponse: quotes.filter(
      (quote) => deriveQuoteStatus(quote.status, quote.validTill) === 'SENT',
    ).length,
    totalValue: quotes.reduce((sum, quote) => sum + (quote.total ?? 0), 0),
  }), [quotes]);

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
    <main className="mx-auto w-full max-w-360 space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Sales</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Quotes</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
            <span>{quoteStats.total} {quoteStats.total === 1 ? 'quote' : 'quotes'}</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>{quoteStats.awaitingResponse} awaiting response</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>{formatInr(quoteStats.totalValue)} quoted</span>
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <TableActions moduleKey="quotes" rows={filteredQuotes} onRefresh={refetch} />
          <Link
            href="/dashboard/quotes/add"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-orange-600 px-3.5 text-sm font-medium text-white transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
          >
            <FilePlus2 size={16} aria-hidden="true" />
            New quote
          </Link>
        </div>
      </header>

      <section aria-label="Quote filters" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <span className="sr-only">Search quotes</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search quotes, customers or deals"
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </label>
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
          <label htmlFor="quote-status" className="sr-only">Filter quotes by status</label>
          <select
            id="quote-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as (typeof FILTERS)[number])}
            className="h-10 min-w-40 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          >
            {FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {filter === 'ALL' ? 'All statuses' : filter.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <span className="hidden pl-2 text-sm text-slate-500 sm:inline">
            {filteredQuotes.length} {filteredQuotes.length === 1 ? 'result' : 'results'}
          </span>
        </div>
      </section>

      <section aria-label="Quotes" className="border-t border-slate-200">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading quotes…</div>
        ) : error ? (
          <div role="alert" className="py-16 text-center text-sm text-rose-700">{error}</div>
        ) : filteredQuotes.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <FileText size={24} className="text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-slate-800">
              {quotes.length === 0 ? 'No quotes yet' : 'No quotes match these filters'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {quotes.length === 0 ? 'Create a quote to start your sales register.' : 'Try another search or status.'}
            </p>
            {quotes.length === 0 ? (
              <Link href="/dashboard/quotes/add" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-orange-700 hover:text-orange-800">
                <FilePlus2 size={16} aria-hidden="true" />
                Create quote
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-190 text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="py-3 pr-4">Quote</th>
                    <th scope="col" className="px-4 py-3">Customer</th>
                    <th scope="col" className="px-4 py-3 text-right">Amount</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Valid until</th>
                    <th scope="col" className="w-12 py-3 pl-4"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuotes.map((quote) => {
                    const status = deriveQuoteStatus(quote.status, quote.validTill);
                    const validityDays = daysUntil(quote.validTill);

                    return (
                      <tr key={quote.id} className="group transition-colors hover:bg-slate-50/70">
                        <td className="py-4 pr-4">
                          <Link href={`/dashboard/quotes/${quote.id}`} className="font-medium text-slate-900 decoration-slate-300 underline-offset-4 hover:text-orange-700 hover:underline">
                            {quote.name || `Quote #${quote.id}`}
                          </Link>
                          <div className="mt-1 text-xs text-slate-500">
                            Q-{quote.id}{quote.deal?.title ? ` · ${quote.deal.title}` : ` · ${formatDate(quote.createdAt)}`}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-800">
                            {quote.customer?.customerName ?? quote.contact?.contactName ?? 'Unassigned customer'}
                          </div>
                          {quote.customer?.customerName && quote.customer.email ? (
                            <div className="mt-1 text-xs text-slate-500">{quote.customer.email}</div>
                          ) : quote.contact?.company ? (
                            <div className="mt-1 text-xs text-slate-500">{quote.contact.company}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-900">{formatInr(quote.total ?? 0)}</td>
                        <td className="px-4 py-4"><StatusBadge status={status} /></td>
                        <td className="px-4 py-4">
                          <div className="text-slate-700">{formatDate(quote.validTill)}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {validityDays === null ? 'No expiry' : validityDays >= 0 ? `${validityDays} days left` : `${Math.abs(validityDays)} days overdue`}
                          </div>
                        </td>
                        <td className="py-2 pl-4 text-right">
                          <QuoteRowActions
                            quoteId={quote.id}
                            isConverted={status === 'CONVERTED'}
                            isLoading={actionLoading === quote.id}
                            onConvert={() => void handleConvert(quote.id)}
                            onDelete={() => void handleDelete(quote.id)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-200 md:hidden">
              {filteredQuotes.map((quote) => {
                const status = deriveQuoteStatus(quote.status, quote.validTill);
                const validityDays = daysUntil(quote.validTill);

                return (
                  <li key={quote.id} className="flex items-start justify-between gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/quotes/${quote.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-orange-700">
                        {quote.name || `Quote #${quote.id}`}
                      </Link>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {quote.customer?.customerName ?? quote.contact?.contactName ?? 'Unassigned customer'} · Q-{quote.id}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <StatusBadge status={status} />
                        <span className="text-xs text-slate-500">
                          {validityDays === null ? 'No expiry' : validityDays >= 0 ? `${validityDays} days left` : `${Math.abs(validityDays)} days overdue`}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start gap-1">
                      <span className="pt-2 text-sm font-semibold tabular-nums text-slate-900">{formatInr(quote.total ?? 0)}</span>
                      <QuoteRowActions
                        quoteId={quote.id}
                        isConverted={status === 'CONVERTED'}
                        isLoading={actionLoading === quote.id}
                        onConvert={() => void handleConvert(quote.id)}
                        onDelete={() => void handleDelete(quote.id)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
