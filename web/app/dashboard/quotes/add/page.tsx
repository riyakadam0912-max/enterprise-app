'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDeals, type Deal } from '@/api/dealsApi';
import { getContacts, type Contact } from '@/api/contactsApi';
import { createQuote, getQuote, updateQuote } from '@/api/quotesApi';
import { getErrorMessage, reportError } from '@/lib/error-handling';
import { formatInr, QUOTE_STATUS_STYLES, quoteLineTotal, sumLineItems } from '@/utils/finance';

interface ItemRow {
  name: string;
  quantity: number;
  price: number;
}

const QUOTE_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'] as const;

export default function AddQuotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetDealId = searchParams.get('dealId') ?? '';
  const presetContactId = searchParams.get('contactId') ?? '';
  const editId = searchParams.get('editId');
  const isEditing = Boolean(editId);

  const [dealId, setDealId] = useState(presetDealId);
  const [contactId, setContactId] = useState(presetContactId);
  const [status, setStatus] = useState<(typeof QUOTE_STATUSES)[number]>('DRAFT');
  const [validTill, setValidTill] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ name: '', quantity: 1, price: 0 }]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [dealList, contactList] = await Promise.all([getDeals(), getContacts()]);
        setDeals(dealList);
        setContacts(contactList);
      } catch (error) {
        reportError(error, 'Unable to load quote metadata');
      }
    }

    loadMeta();
  }, []);

  useEffect(() => {
    if (!editId) return;
    getQuote(Number(editId))
      .then((quote) => {
        setDealId(String(quote.dealId));
        setContactId(String(quote.contactId));
        setStatus(quote.status as (typeof QUOTE_STATUSES)[number]);
        setValidTill(quote.validTill.slice(0, 10));
        setNotes(quote.notes ?? '');
        setItems(quote.items.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })));
      })
      .catch((error) => {
        reportError(error, 'Unable to load quote');
        setError('Failed to load quote.');
      });
  }, [editId]);

  const total = useMemo(() => sumLineItems(items), [items]);

  function addItem() {
    setItems((prev) => [...prev, { name: '', quantity: 1, price: 0 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, current) => current !== index)));
  }

  function updateItem(index: number, field: keyof ItemRow, value: string | number) {
    setItems((prev) => prev.map((item, current) => (current === index ? { ...item, [field]: value } : item)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!dealId || !contactId || !validTill) {
      setError('Please select a deal, contact, and validity date.');
      return;
    }

    if (items.some((item) => !item.name.trim())) {
      setError('Each quote line item needs a name.');
      return;
    }

    const payload = {
      dealId: Number(dealId),
      contactId: Number(contactId),
      status,
      validTill,
      notes: notes || undefined,
      items: items.map((item) => ({ name: item.name.trim(), quantity: Number(item.quantity), price: Number(item.price) })),
    };

    setLoading(true);
    try {
      if (isEditing && editId) {
        await updateQuote(Number(editId), payload);
      } else {
        await createQuote(payload);
      }
      router.push('/dashboard/quotes');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save quote');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/quotes" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Sales proposal</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{isEditing ? 'Edit quote' : 'New quote'}</h1>
            <p className="mt-1 text-sm text-slate-500">Build a proposal with a valid-until date, client and deal context, and itemized pricing.</p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Deal</span>
              <select value={dealId} onChange={(event) => setDealId(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400">
                <option value="">Select deal</option>
                {deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.title}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Client</span>
              <select value={contactId} onChange={(event) => setContactId(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400">
                <option value="">Select contact</option>
                {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.contactName}{contact.company ? ` (${contact.company})` : ''}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as (typeof QUOTE_STATUSES)[number])} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400">
                {QUOTE_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Valid until</span>
              <input type="date" value={validTill} onChange={(event) => setValidTill(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
            </label>
          </div>

          <label className="mt-4 block space-y-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes and terms</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" placeholder="Proposal notes, commercial terms, or follow-up instructions" />
          </label>

          {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div> : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Quote items</h2>
              <p className="text-sm text-slate-500">Itemized pricing for the proposal sent to the customer.</p>
            </div>
            <button type="button" onClick={addItem} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Add line
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div key={`${index}-${item.name}`} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[1.8fr_0.6fr_0.8fr_auto] md:items-end">
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Item</span>
                  <input value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</span>
                  <input type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', Number(event.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Rate</span>
                  <input type="number" min="0" step="0.01" value={item.price} onChange={(event) => updateItem(index, 'price', Number(event.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
                </label>
                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <div className="text-sm font-semibold text-slate-900">{formatInr(quoteLineTotal(item))}</div>
                  <button type="button" onClick={() => removeItem(index)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-end">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proposal total</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatInr(total)}</p>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => router.push('/dashboard/quotes')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60">
            {loading ? 'Saving…' : isEditing ? 'Update Quote' : 'Save Quote'}
          </button>
        </div>
      </form>
    </div>
  );
}
