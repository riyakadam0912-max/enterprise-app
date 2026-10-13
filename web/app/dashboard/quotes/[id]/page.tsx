'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, CalendarDays, Download, FileText, Mail, MessageCircle, Pencil, Send, Trash2 } from 'lucide-react';
import { useQuote, useUpdateQuote, useDeleteQuote, useConvertQuoteToInvoice } from '@/hooks/useQuotes';
import { createQuotePublicLink, downloadQuotePdf, sendQuoteEmail } from '@/api/quotesApi';
//import { Quote } from '@/api/quotesApi';
import {
  QUOTE_STATUS_STYLES,
  deriveQuoteStatus,
  daysUntil,
  formatDate,
  formatInr,
  quoteLineTotal,
} from '@/utils/finance';

function StatusBadge({ status }: { status: string }) {
  const cls = QUOTE_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
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
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const quoteStatus = quote ? deriveQuoteStatus(quote.status, quote.validTill) : 'DRAFT';
  const validityDays = quote ? daysUntil(quote.validTill) : null;
  const lineTotal = quote ? quote.items.reduce((sum, item) => sum + quoteLineTotal(item) - (item.discountAmount ?? 0), 0) : 0;
  const taxTotal = quote ? quote.items.reduce((sum, item) => sum + Math.max(0, quoteLineTotal(item) - (item.discountAmount ?? 0)) * (item.taxRate ?? 0) / 100, 0) : 0;

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

  async function handleDownloadPdf() {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const blob = await downloadQuotePdf(id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `quote-${id}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setShareMessage('PDF download started.');
    } catch (cause: unknown) {
      const error = cause as {
        message?: string;
        response?: {
          headers?: Record<string, string | undefined>;
          data?: { requestId?: string; message?: string };
        };
      };
      const requestId =
        error.response?.headers?.['x-request-id'] ??
        error.response?.data?.requestId;
      const serverMessage = error.response?.data?.message;
      setShareMessage(
        requestId
          ? `PDF export failed. Reference: ${requestId}`
          : serverMessage ?? error.message ?? 'PDF export failed. Please try again.',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleWhatsAppShare() {
    if (!quote || actionLoading) return;
    setActionLoading(true);
    setShareMessage(null);
    try {
      const { publicQuoteUrl } = await createQuotePublicLink(id);
      const message = `Hello ${quote.customer?.customerName ?? 'there'},\n\nYour quote Q-${quote.id} for ${formatInr(quote.total)} is ready.\n\nView and respond to your quote:\n${publicQuoteUrl}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      const popup = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      setShareMessage(popup ? 'WhatsApp share opened with a secure quote link.' : 'Your browser blocked the WhatsApp window. Please allow popups and try again.');
      router.refresh();
    } catch (cause) {
      setShareMessage(cause instanceof Error ? cause.message : 'Unable to create a public quote link.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEmailPdf() {
    if (!quote || actionLoading) return;
    const recipient = emailRecipient.trim() || quote.customer?.email || '';
    if (!recipient) {
      setShareMessage('Add a customer email address before sending the PDF.');
      return;
    }
    setActionLoading(true);
    setShareMessage(null);
    try {
      await sendQuoteEmail(id, { recipient });
      setShareMessage(`PDF sent to ${recipient}.`);
      router.refresh();
    } catch (cause) {
      setShareMessage(cause instanceof Error ? cause.message : 'Unable to send the quote PDF.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading quote…</div>;
  if (error || !quote) return <div className="p-6 text-sm text-red-500">{error ?? 'Quote not found'}</div>;

  const iconButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
  const quoteCustomerName = quote.customer?.customerName ?? quote.contact?.contactName ?? 'Unassigned customer';
  const quoteAddress = quote.customerAddress || (quote.customer ? [quote.customer.addressLine1, quote.customer.addressLine2, quote.customer.city, quote.customer.state, quote.customer.zipCode].filter(Boolean).join(', ') : '');

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:py-8">
      <header className="space-y-5 border-b border-slate-200 pb-5">
        <Link href="/dashboard/quotes" className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900">
          <ArrowLeft size={16} strokeWidth={1.8} /> Quotes
        </Link>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-950">{quote.name || `Quote #${quote.id}`}</h1>
              <StatusBadge status={quoteStatus} />
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span>Q-{quote.id}</span><span aria-hidden="true">·</span>
              <span>Created {formatDate(quote.createdAt)}</span><span aria-hidden="true">·</span>
              <span>{validityDays === null ? 'No expiry' : validityDays >= 0 ? `${validityDays} days remaining` : `${Math.abs(validityDays)} days expired`}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quote.status === 'DRAFT' && <button type="button" onClick={handleSend} disabled={actionLoading} className={`${iconButtonClass} border-slate-900 bg-slate-900 text-white hover:bg-slate-800`}><Send size={15} />Send</button>}
            <Link href={`/dashboard/quotes/add?editId=${quote.id}`} className={iconButtonClass}><Pencil size={15} />Edit</Link>
            <button type="button" onClick={handleDownloadPdf} disabled={actionLoading} title="Export quote as PDF" className={iconButtonClass}><Download size={15} />PDF</button>
            <button type="button" onClick={handleWhatsAppShare} disabled={actionLoading} title="Share quote via WhatsApp" className={`${iconButtonClass} text-emerald-700`}><MessageCircle size={15} />WhatsApp</button>
            {quote.status !== 'ACCEPTED' && <button type="button" onClick={handleConvert} disabled={actionLoading} className={iconButtonClass}><FileText size={15} />Convert</button>}
            <button type="button" onClick={handleDelete} disabled={actionLoading} title="Delete quote" aria-label="Delete quote" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Trash2 size={16} /></button>
          </div>
        </div>
        {shareMessage ? <p role="status" className="text-sm text-slate-600">{shareMessage}</p> : null}
      </header>

      <section aria-label="Quote summary" className="grid grid-cols-2 gap-y-5 border-b border-slate-200 pb-6 sm:grid-cols-3 lg:grid-cols-6">
        <div><p className="text-xs font-medium text-slate-500">Subtotal</p><p className="mt-1 text-base font-semibold text-slate-900">{formatInr(quote.subtotal ?? lineTotal)}</p></div>
        <div><p className="text-xs font-medium text-slate-500">Discount</p><p className="mt-1 text-base font-semibold text-slate-900">−{formatInr(quote.discountAmount ?? 0)}</p></div>
        <div><p className="text-xs font-medium text-slate-500">Tax</p><p className="mt-1 text-base font-semibold text-slate-900">{formatInr(quote.taxAmount ?? taxTotal)}</p></div>
        {quote.tdsEnabled ? <div><p className="text-xs font-medium text-slate-500">TDS</p><p className="mt-1 text-base font-semibold text-slate-900">−{formatInr(quote.tdsAmount ?? 0)}</p></div> : null}
        {quote.tcsEnabled ? <div><p className="text-xs font-medium text-slate-500">TCS</p><p className="mt-1 text-base font-semibold text-slate-900">{formatInr(quote.tcsAmount ?? 0)}</p></div> : null}
        <div className="col-span-2 border-t border-slate-200 pt-4 sm:col-span-1 sm:border-0 sm:pt-0 lg:text-right"><p className="text-xs font-medium text-slate-500">Total</p><p className="mt-1 text-xl font-semibold text-slate-950">{formatInr(quote.total)}</p></div>
      </section>

      <section className="grid gap-7 border-b border-slate-200 pb-7 md:grid-cols-2">
        <div>
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Building2 size={15} />Customer</h2>
          <p className="mt-3 font-medium text-slate-900">{quoteCustomerName}</p>
          {quote.customer?.email && <p className="mt-1 text-sm text-slate-600">{quote.customer.email}</p>}
          {quoteAddress && <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">{quoteAddress}</p>}
          {quote.contact && !quote.customer && <>{quote.contact.company && <p className="mt-1 text-sm text-slate-600">{quote.contact.company}</p>}{quote.contact.email && <p className="mt-1 text-sm text-slate-600">{quote.contact.email}</p>}</>}
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div><h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><CalendarDays size={15} />Issued</h2><p className="mt-3 text-sm font-medium text-slate-900">{formatDate(quote.quoteDate ?? quote.createdAt)}</p></div>
          <div><h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><CalendarDays size={15} />Valid until</h2><p className="mt-3 text-sm font-medium text-slate-900">{formatDate(quote.validTill)}</p></div>
          {quote.deal && <div className="col-span-2"><p className="text-xs font-medium text-slate-500">Related deal</p><Link href={`/dashboard/deals/${quote.deal.id}`} className="mt-1 inline-block text-sm font-medium text-orange-700 hover:underline">{quote.deal.title}</Link><p className="mt-1 text-xs text-slate-500">{quote.deal.stage} · {formatInr(quote.deal.value)}</p></div>}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Items</h2>
          <span className="text-xs text-slate-500">{quote.items.length} {quote.items.length === 1 ? 'line' : 'lines'}</span>
        </div>
        <div className="overflow-x-auto border-y border-slate-200">
          <table className="w-full min-w-150 text-sm">
            <thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="py-3 pr-4 text-left font-medium">Description</th><th className="px-3 py-3 text-center font-medium">Qty</th><th className="px-3 py-3 text-right font-medium">Rate</th><th className="py-3 pl-3 text-right font-medium">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {quote.items.map((item) => <tr key={item.id}>
                <td className="py-4 pr-4"><p className="font-medium text-slate-900">{item.name}</p>{item.description && <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>}<p className="mt-1 text-xs text-slate-400">{item.unit || 'Unit'}{item.type ? ` · ${item.type === 'GOODS' ? 'Goods' : 'Service'}` : ''}</p></td>
                <td className="px-3 py-4 text-center text-slate-600">{item.quantity}</td>
                <td className="px-3 py-4 text-right text-slate-600">{formatInr(item.price)}</td>
                <td className="py-4 pl-3 text-right font-medium text-slate-900">{formatInr(Math.max(0, quoteLineTotal(item) - (item.discountAmount ?? 0)))}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-8 border-t border-slate-200 pt-6 md:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {quote.termsAndConditions && <div><h2 className="text-sm font-semibold text-slate-900">Terms and conditions</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{quote.termsAndConditions}</p></div>}
          <div><h2 className="text-sm font-semibold text-slate-900">Internal notes</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{quote.notes || 'No notes.'}</p></div>
        </div>
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Send PDF by email</h2>
          <div className="flex gap-2"><label className="sr-only" htmlFor="quote-email-recipient">Recipient email</label><input id="quote-email-recipient" type="email" value={emailRecipient} onChange={(event) => setEmailRecipient(event.target.value)} placeholder={quote.customer?.email ?? 'Recipient email'} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" /><button type="button" onClick={handleEmailPdf} disabled={actionLoading} aria-label="Email PDF" title="Email PDF" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-700 disabled:opacity-50"><Mail size={16} /></button></div>
          <p className="text-xs leading-5 text-slate-500">The selected quote template is attached as a PDF.</p>
        </div>
      </section>
    </main>
  );
}
