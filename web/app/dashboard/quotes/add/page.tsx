'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDeals, type Deal } from '@/api/dealsApi';
import { getContacts, type Contact } from '@/api/contactsApi';
import { createCustomer, getCustomers, type Customer, type CustomerInput } from '@/api/customersApi';
import { getProducts } from '@/api/productsApi';
import type { Product } from '@/types/entities';
import { createQuote, getQuote, updateQuote } from '@/api/quotesApi';
import { reportError } from '@/lib/error-handling';
import { formatInr, quoteLineTotal, sumLineItems } from '@/utils/finance';

interface ItemRow {
  name: string;
  productId?: number;
  description?: string;
  quantity: number;
  price: number;
  discountAmount: number;
  taxRate: number;
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
  const [customerId, setCustomerId] = useState('');
  const [quoteName, setQuoteName] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerAddress, setCustomerAddress] = useState('');
  const [status, setStatus] = useState<(typeof QUOTE_STATUSES)[number]>('DRAFT');
  const [validTill, setValidTill] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [items, setItems] = useState<ItemRow[]>([{ name: '', quantity: 1, price: 0, discountAmount: 0, taxRate: 0 }]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<CustomerInput>>({ customerType: 'BUSINESS', country: 'India' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [dealList, contactList, customerList, productList] = await Promise.all([getDeals(), getContacts(), getCustomers(), getProducts()]);
        setDeals(dealList);
        setContacts(contactList);
        setCustomers(customerList);
        setProducts(productList);
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
        setCustomerId(quote.customerId ? String(quote.customerId) : '');
        setQuoteName(quote.name ?? '');
        setQuoteDate((quote.quoteDate ?? quote.createdAt).slice(0, 10));
        setCustomerAddress(quote.customerAddress ?? '');
        setStatus(quote.status as (typeof QUOTE_STATUSES)[number]);
        setValidTill(quote.validTill.slice(0, 10));
        setNotes(quote.notes ?? '');
        setTermsAndConditions(quote.termsAndConditions ?? '');
        setDiscountAmount(quote.discountAmount ?? 0);
        setAdjustmentAmount(quote.adjustmentAmount ?? 0);
        setItems(quote.items.map((item) => ({ name: item.name, productId: item.productId ?? undefined, description: item.description ?? '', quantity: item.quantity, price: item.price, discountAmount: item.discountAmount ?? 0, taxRate: item.taxRate ?? 0 })));
      })
      .catch((error) => {
        reportError(error, 'Unable to load quote');
        setError('Failed to load quote.');
      });
  }, [editId]);

  const subtotal = useMemo(() => sumLineItems(items), [items]);
  const taxTotal = useMemo(() => items.reduce((sum, item) => sum + Math.max(0, item.quantity * item.price - item.discountAmount) * item.taxRate / 100, 0), [items]);
  const total = subtotal - Number(discountAmount || 0) + taxTotal + Number(adjustmentAmount || 0);

  function addItem() {
    setItems((prev) => [...prev, { name: '', quantity: 1, price: 0, discountAmount: 0, taxRate: 0 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, current) => current !== index)));
  }

  function updateItem(index: number, field: keyof ItemRow, value: string | number) {
    setItems((prev) => prev.map((item, current) => (current === index ? { ...item, [field]: value } : item)));
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((item) => item.id === Number(productId));
    if (!product) return updateItem(index, 'productId', 0);
    setItems((prev) => prev.map((item, current) => current === index ? { ...item, productId: product.id, name: product.name, description: product.description ?? '', price: product.price, taxRate: product.taxRate ?? 0 } : item));
  }

  async function handleCreateCustomer(event: React.FormEvent) {
    event.preventDefault();
    if (!newCustomer.customerName || !newCustomer.addressLine1 || !newCustomer.city || !newCustomer.state || !newCustomer.country || !newCustomer.zipCode) return;
    const created = await createCustomer(newCustomer as CustomerInput);
    setCustomers((prev) => [...prev, created]);
    setCustomerId(String(created.id));
    setCustomerAddress([created.addressLine1, created.addressLine2, created.city, created.state, created.zipCode].filter(Boolean).join(', '));
    setCustomerModalOpen(false);
    setNewCustomer({ customerType: 'BUSINESS', country: 'India' });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!customerId || !validTill || !quoteDate) {
      setError('Please select a customer and provide quote dates.');
      return;
    }

    if (items.some((item) => !item.name.trim())) {
      setError('Each quote line item needs a name.');
      return;
    }

    const payload = {
      dealId: dealId ? Number(dealId) : undefined,
      contactId: contactId ? Number(contactId) : undefined,
      customerId: Number(customerId),
      name: quoteName || undefined,
      quoteDate,
      customerAddress: customerAddress || undefined,
      status,
      validTill,
      notes: notes || undefined,
      termsAndConditions: termsAndConditions || undefined,
      discountAmount: Number(discountAmount),
      adjustmentAmount: Number(adjustmentAmount),
      items: items.map((item) => ({ name: item.name.trim(), productId: item.productId, description: item.description, quantity: Number(item.quantity), price: Number(item.price), discountAmount: Number(item.discountAmount), taxRate: Number(item.taxRate) })),
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
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Quote name</span>
              <input value={quoteName} onChange={(event) => setQuoteName(event.target.value)} placeholder="e.g. Website redesign proposal" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</span>
              <div className="flex gap-2"><select value={customerId} onChange={(event) => { setCustomerId(event.target.value); const customer = customers.find((item) => item.id === Number(event.target.value)); if (customer) setCustomerAddress([customer.addressLine1, customer.addressLine2, customer.city, customer.state, customer.zipCode].filter(Boolean).join(', ')); }} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400">
                <option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customerName}</option>)}
              </select><button type="button" onClick={() => setCustomerModalOpen(true)} className="rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50" title="Create customer">+</button></div>
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Quote date</span>
              <input type="date" value={quoteDate} onChange={(event) => setQuoteDate(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
            </label>
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
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Customer address <span className="font-normal normal-case text-slate-400">(optional override)</span></span>
            <input value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
          </label>

          <label className="mt-4 block space-y-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes and terms</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" placeholder="Proposal notes, commercial terms, or follow-up instructions" />
          </label>

          <label className="mt-4 block space-y-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Terms and conditions</span>
            <textarea value={termsAndConditions} onChange={(event) => setTermsAndConditions(event.target.value)} rows={3} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" placeholder="Payment terms, delivery terms, validity, and acceptance conditions" />
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
                  <select value={item.productId ?? ''} onChange={(event) => selectProduct(index, event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400">
                    <option value="">Select service</option>
                    {products.filter((product) => product.isActive).map((product) => <option key={product.id} value={product.id}>{product.name} · {formatInr(product.price)}</option>)}
                  </select>
                  <input value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} placeholder="Or enter a custom item" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</span>
                  <input type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', Number(event.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Rate</span>
                  <input type="number" min="0" step="0.01" value={item.price} onChange={(event) => updateItem(index, 'price', Number(event.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Tax %</span>
                  <input type="number" min="0" step="0.01" value={item.taxRate} onChange={(event) => updateItem(index, 'taxRate', Number(event.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
                </label>
                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <div className="text-sm font-semibold text-slate-900">{formatInr(quoteLineTotal(item))}</div>
                  <button type="button" onClick={() => removeItem(index)} aria-label="Remove item" title="Remove item" className="rounded-xl border border-slate-200 p-2 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={items.length === 1}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col items-end gap-3">
            <label className="flex items-center gap-3 text-sm text-slate-600">Discount <input type="number" min="0" step="0.01" value={discountAmount} onChange={(event) => setDiscountAmount(Number(event.target.value))} className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-right outline-none focus:border-orange-400" /></label>
            <label className="flex items-center gap-3 text-sm text-slate-600">Adjustment <input type="number" step="0.01" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(Number(event.target.value))} className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-right outline-none focus:border-orange-400" /></label>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Calculated total</p>
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
      {customerModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" role="dialog" aria-modal="true" aria-label="Create customer">
        <form onSubmit={handleCreateCustomer} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Create customer</h2><p className="mt-1 text-sm text-slate-500">Save a customer and use it in this quote.</p></div><button type="button" onClick={() => setCustomerModalOpen(false)} className="text-xl text-slate-400" aria-label="Close">×</button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {([['customerName', 'Customer name'], ['addressLine1', 'Address'], ['city', 'City'], ['state', 'State'], ['zipCode', 'Postal code'], ['phoneNumber', 'Phone']] as const).map(([field, label]) => <label key={field} className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span><input required={['customerName', 'addressLine1', 'city', 'state', 'zipCode'].includes(field)} value={String(newCustomer[field] ?? '')} onChange={(event) => setNewCustomer((prev) => ({ ...prev, [field]: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400" /></label>)}
          </div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCustomerModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button><button type="submit" className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white">Create customer</button></div>
        </form>
      </div>}
    </div>
  );
}
