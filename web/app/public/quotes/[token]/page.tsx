'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { decidePublicQuote, getPublicQuote, type PublicQuote } from '@/api/quotesApi';
import { formatDate, formatInr } from '@/utils/finance';

function StatusBadge({ status }: { status: string }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{status}</span>;
}

export default function PublicQuotePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  useEffect(() => {
    getPublicQuote(token)
      .then(setQuote)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'This quote link is unavailable.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function decide(decision: 'accept' | 'reject') {
    if (!quote || decisionLoading) return;
    setDecisionLoading(true);
    setDecisionError(null);
    try {
      setQuote(await decidePublicQuote(token, decision, comment));
      setComment('');
    } catch (cause) {
      setDecisionError(cause instanceof Error ? cause.message : 'Unable to record your response.');
    } finally {
      setDecisionLoading(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-4xl p-6 text-sm text-slate-500">Loading quote...</main>;
  if (error || !quote) return <main className="mx-auto max-w-4xl p-6"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error ?? 'This quote is unavailable.'}</div></main>;

  const canDecide = quote.status === 'SENT' && new Date(quote.validTill).getTime() >= Date.now();
  const customerName = quote.customer?.customerName ?? 'Customer';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-3xl bg-slate-900 p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">{quote.company.name}</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{quote.name || quote.quoteNumber}</h1><p className="mt-2 text-sm text-slate-300">{quote.quoteNumber} · Issued {formatDate(quote.quoteDate)} · Valid until {formatDate(quote.validTill)}</p></div>
            <StatusBadge status={quote.status} />
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1fr_18rem]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-800">Quote for {customerName}</h2><p className="mt-1 text-sm text-slate-500">{quote.customerAddress || quote.customer?.address || 'Address not provided'}</p></div>
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 text-left">Item</th><th className="px-5 py-3 text-right">Qty</th><th className="px-5 py-3 text-right">Rate</th><th className="px-5 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{quote.items.map((item) => <tr key={`${item.name}-${item.quantity}`}><td className="px-5 py-4"><p className="font-medium text-slate-800">{item.name}</p>{item.description ? <p className="mt-1 text-xs text-slate-500">{item.description}</p> : null}</td><td className="px-5 py-4 text-right text-slate-600">{item.quantity}</td><td className="px-5 py-4 text-right text-slate-600">{formatInr(item.price)}</td><td className="px-5 py-4 text-right font-medium text-slate-800">{formatInr(Math.max(0, item.quantity * item.price - item.discountAmount))}</td></tr>)}</tbody></table></div>
            <div className="space-y-2 border-t border-slate-100 bg-slate-50 px-5 py-4 text-sm"><div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatInr(quote.subtotal)}</span></div><div className="flex justify-between text-slate-600"><span>Tax</span><span>{formatInr(quote.taxAmount)}</span></div><div className="flex justify-between pt-2 text-base font-semibold text-slate-900"><span>Total</span><span>{formatInr(quote.total)}</span></div></div>
          </div>

          <aside className="space-y-5">
            {canDecide ? <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-800">Respond to quote</h2><p className="mt-1 text-sm text-slate-500">Add an optional comment before choosing an action.</p><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} placeholder="Comment (optional)" className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400" />{decisionError ? <p role="alert" className="mt-3 text-sm text-rose-600">{decisionError}</p> : null}<div className="mt-4 grid gap-2"><button type="button" disabled={decisionLoading} onClick={() => decide('accept')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{decisionLoading ? 'Saving...' : 'Accept quote'}</button><button type="button" disabled={decisionLoading} onClick={() => decide('reject')} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60">Reject quote</button></div></section> : <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-800">Response recorded</h2><p className="mt-2 text-sm text-slate-500">This quote is currently {quote.status.toLowerCase()}. No further response is required.</p></section>}
            {quote.termsAndConditions ? <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-800">Terms</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{quote.termsAndConditions}</p></section> : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
