'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuote, useUpdateQuote, useDeleteQuote, useConvertQuoteToInvoice } from '@/hooks/useQuotes';
//import { Quote } from '@/api/quotesApi';
import {
  QUOTE_STATUS_STYLES,
  deriveQuoteStatus,
  daysBetween,
  daysUntil,
  formatDate,
  formatInr,
  quoteLineTotal,
} from '@/utils/finance';

function StatusBadge({ status }: { status: string }) {
  const cls = QUOTE_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const { data: quote, loading, error } = useQuote(id);
  const { update }  = useUpdateQuote();
  const { remove }  = useDeleteQuote();
  const { convert } = useConvertQuoteToInvoice();
  const [actionLoading, setActionLoading] = useState(false);
  const quoteStatus = quote ? deriveQuoteStatus(quote.status, quote.validTill) : 'DRAFT';
  const quoteAge = quote ? daysBetween(quote.createdAt) ?? 0 : 0;
  const validityDays = quote ? daysUntil(quote.validTill) : null;
  const lineTotal = quote ? quote.items.reduce((sum, item) => sum + quoteLineTotal(item), 0) : 0;

  async function handleSend() {
    if (!quote || actionLoading) return;
    setActionLoading(true);
    try {
      await update(id, { status: 'SENT' });
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConvert() {
    if (!confirm('Convert this quote to an invoice?')) return;
    setActionLoading(true);
    try {
      await convert(id);
      router.push('/dashboard/invoices');
    } catch {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this quote? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      await remove(id);
      router.push('/dashboard/quotes');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading quote…</div>;
  if (error || !quote) return <div className="p-6 text-sm text-red-500">{error ?? 'Quote not found'}</div>;

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/dashboard/quotes"
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-slate-900">Quote #{quote.id}</h1>
                <StatusBadge status={quoteStatus} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Created {formatDate(quote.createdAt)} · {quoteAge} days old · {validityDays === null ? 'No validity set' : validityDays >= 0 ? `${validityDays} days left` : `${Math.abs(validityDays)} days expired`}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subtotal</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatInr(lineTotal)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tax</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatInr(0)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Discount</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatInr(0)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grand total</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatInr(quote.total ?? 0)}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {quote.status === 'DRAFT' && (
            <button
              onClick={handleSend}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-600 disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Send Quote
            </button>
          )}
          <Link
            href={`/dashboard/quotes/add?editId=${quote.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Quote
          </Link>
          {quote.status !== 'ACCEPTED' && (
            <button
              onClick={handleConvert}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-orange-200 transition-colors hover:bg-orange-600 disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              Convert to Invoice
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={actionLoading}
            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
            title="Delete quote"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
            </svg>
            Deal
          </h2>
          {quote.deal ? (
            <div className="space-y-2 text-sm">
              <Link
                href={`/dashboard/deals/${quote.deal.id}`}
                className="font-medium text-orange-600 hover:underline"
              >
                {quote.deal.title}
              </Link>
              <div className="flex gap-4 text-slate-500">
                <span>Value: <span className="font-medium text-slate-700">{formatInr(quote.deal.value)}</span></span>
                <span>Stage: <span className="text-slate-700 font-medium">{quote.deal.stage}</span></span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No deal linked</p>
          )}
        </div>

        {/* Contact info */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
            </svg>
            Client
          </h2>
          {quote.contact ? (
            <div className="space-y-1 text-sm">
              <Link
                href={`/dashboard/contacts/${quote.contact.id}`}
                className="font-medium text-orange-600 hover:underline"
              >
                {quote.contact.contactName}
              </Link>
              {quote.contact.company && <p className="text-slate-500">{quote.contact.company}</p>}
              {quote.contact.email && <p className="text-slate-500">{quote.contact.email}</p>}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No contact linked</p>
          )}
        </div>
      </div>

      {/* Quote items */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Quote Items</h2>
          <div className="text-xs text-slate-400">
            Valid till: <span className="font-medium text-slate-600">{formatDate(quote.validTill)}</span>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Item</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">Qty</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Unit Price</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quote.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3.5 text-slate-700 font-medium">{item.name}</td>
                <td className="px-5 py-3.5 text-slate-500 text-center">{item.quantity}</td>
                <td className="px-5 py-3.5 text-slate-500 text-right">
                  {formatInr(item.price)}
                </td>
                <td className="px-5 py-3.5 text-slate-700 font-medium text-right">
                  {formatInr(quoteLineTotal(item))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td colSpan={3} className="px-5 py-4 text-sm font-semibold text-slate-600 text-right">Total</td>
              <td className="px-5 py-4 text-lg font-bold text-slate-800 text-right">
                {formatInr(quote.total ?? 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Workflow notes</h2>
          <p className="mt-2 text-sm text-slate-500">Quotes are proposals. Send them to start follow-up, convert accepted quotes into invoices, and treat expired proposals as stale opportunities.</p>
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            Validity window: {formatDate(quote.validTill)}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Notes</h2>
          <p className="text-sm text-slate-500 whitespace-pre-wrap">{quote.notes ?? 'No internal notes captured.'}</p>
        </div>
      </div>
    </div>
  );
}
