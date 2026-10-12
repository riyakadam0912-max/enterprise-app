'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCustomers, type Customer } from '@/api/customersApi';
import { getProducts } from '@/api/productsApi';
import type { Product } from '@/types/entities';
import { createQuote, getQuote, updateQuote } from '@/api/quotesApi';
import { reportError } from '@/lib/error-handling';
import { formatInr, quoteLineTotal, sumLineItems } from '@/utils/finance';
import { useAuthSession } from '@/stores/auth-store';
import { CustomerPickerModal } from '@/components/quotes/CustomerPickerModal';
import { ServicePickerModal } from '@/components/quotes/ServicePickerModal';

interface ItemRow {
  name: string;
  productId?: number;
  unit: string;
  type: 'GOODS' | 'SERVICE';
  description?: string;
  quantity: number;
  price: number;
  discountAmount: number;
  taxRate: number;
}

const QUOTE_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'] as const;
const QUOTE_TEMPLATES = [
  { key: 'minimal', label: 'Minimal' },
  { key: 'professional', label: 'Professional' },
  { key: 'modern', label: 'Modern' },
  { key: 'classic', label: 'Classic' },
] as const;

export default function AddQuotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');
  const isEditing = Boolean(editId);
  const session = useAuthSession();
  const canCreateService = session.isSuperAdmin || session.role === 'ADMIN' || session.permissions.includes('product.create');

  const [customerId, setCustomerId] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerAddress, setCustomerAddress] = useState('');
  const [status, setStatus] = useState<(typeof QUOTE_STATUSES)[number]>('DRAFT');
  const [templateKey, setTemplateKey] = useState<(typeof QUOTE_TEMPLATES)[number]['key']>('minimal');
  const [validTill, setValidTill] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountType, setDiscountType] = useState<'AMOUNT' | 'PERCENTAGE'>('AMOUNT');
  const [discountRate, setDiscountRate] = useState(0);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [adjustmentType, setAdjustmentType] = useState<'AMOUNT' | 'PERCENTAGE'>('AMOUNT');
  const [adjustmentRate, setAdjustmentRate] = useState(0);
  const [tdsEnabled, setTdsEnabled] = useState(false);
  const [tdsRate, setTdsRate] = useState(0);
  const [tcsEnabled, setTcsEnabled] = useState(false);
  const [tcsRate, setTcsRate] = useState(0);
  const [items, setItems] = useState<ItemRow[]>([{ name: '', unit: 'Unit', type: 'SERVICE', quantity: 1, price: 0, discountAmount: 0, taxRate: 0 }]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [serviceModalIndex, setServiceModalIndex] = useState<number | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMeta() {
      setMetadataLoading(true);
      setMetadataError(null);
      try {
        const [customerList, productList] = await Promise.all([getCustomers(), getProducts()]);
        setCustomers(customerList);
        setProducts(productList);
      } catch (error) {
        reportError(error, 'Unable to load quote metadata');
        setMetadataError('Unable to load customers and services.');
      } finally {
        setMetadataLoading(false);
      }
    }

    loadMeta();
  }, []);

  useEffect(() => {
    if (!editId) return;
    getQuote(Number(editId))
      .then((quote) => {
        setCustomerId(quote.customerId ? String(quote.customerId) : '');
        setQuoteDate((quote.quoteDate ?? quote.createdAt).slice(0, 10));
        setCustomerAddress(quote.customerAddress ?? '');
        setStatus(quote.status as (typeof QUOTE_STATUSES)[number]);
        setTemplateKey((QUOTE_TEMPLATES.some((template) => template.key === quote.templateKey) ? quote.templateKey : 'minimal') as (typeof QUOTE_TEMPLATES)[number]['key']);
        setValidTill(quote.validTill.slice(0, 10));
        setNotes(quote.notes ?? '');
        setTermsAndConditions(quote.termsAndConditions ?? '');
        setDiscountAmount(quote.discountAmount ?? 0);
        setDiscountType(quote.discountType ?? 'AMOUNT');
        setDiscountRate(quote.discountRate ?? 0);
        setAdjustmentAmount(quote.adjustmentAmount ?? 0);
        setAdjustmentType(quote.adjustmentType ?? 'AMOUNT');
        setAdjustmentRate(quote.adjustmentRate ?? 0);
        setTdsEnabled(quote.tdsEnabled ?? false);
        setTdsRate(quote.tdsRate ?? 0);
        setTcsEnabled(quote.tcsEnabled ?? false);
        setTcsRate(quote.tcsRate ?? 0);
        setItems(quote.items.map((item) => ({ name: item.name, productId: item.productId ?? undefined, unit: item.unit ?? 'Unit', type: item.type === 'GOODS' ? 'GOODS' : 'SERVICE', description: item.description ?? '', quantity: item.quantity, price: item.price, discountAmount: item.discountAmount ?? 0, taxRate: item.taxRate ?? 0 })));
      })
      .catch((error) => {
        reportError(error, 'Unable to load quote');
        setError('Failed to load quote.');
      });
  }, [editId]);

  const grossSubtotal = useMemo(() => sumLineItems(items), [items]);
  const lineDiscountTotal = useMemo(() => items.reduce((sum, item) => sum + Math.min(item.quantity * item.price, item.discountAmount), 0), [items]);
  const subtotal = Math.max(0, grossSubtotal - lineDiscountTotal);
  const quoteDiscount = discountType === 'PERCENTAGE' ? subtotal * discountRate / 100 : discountAmount;
  const taxableSubtotal = Math.max(0, subtotal - quoteDiscount);
  const taxTotal = useMemo(() => items.reduce((sum, item) => sum + Math.max(0, item.quantity * item.price - item.discountAmount) * item.taxRate / 100, 0), [items]);
  const tdsAmount = tdsEnabled ? taxableSubtotal * tdsRate / 100 : 0;
  const tcsAmount = tcsEnabled ? taxableSubtotal * tcsRate / 100 : 0;
  const adjustmentTotal = adjustmentType === 'PERCENTAGE' ? taxableSubtotal * adjustmentRate / 100 : adjustmentAmount;
  const total = taxableSubtotal + taxTotal + tcsAmount - tdsAmount + adjustmentTotal;

  function addItem() {
    setItems((prev) => [...prev, { name: '', unit: 'Unit', type: 'SERVICE', quantity: 1, price: 0, discountAmount: 0, taxRate: 0 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, current) => current !== index)));
  }

  function updateItem(index: number, field: keyof ItemRow, value: string | number) {
    setItems((prev) => prev.map((item, current) => (current === index ? { ...item, [field]: value } : item)));
  }

  function selectProduct(index: number, product: Product) {
    setItems((prev) => prev.map((item, current) => current === index ? { ...item, productId: product.id, name: product.name, unit: product.unit, type: product.type, description: product.description ?? '', price: product.price, taxRate: product.taxRate ?? 0 } : item));
    setServiceModalIndex(null);
  }

  function selectCustomer(customer: Customer) {
    const address = [customer.addressLine1, customer.addressLine2, customer.city, customer.state, customer.zipCode].filter(Boolean).join(', ');
    setCustomers((prev) => prev.some((item) => item.id === customer.id) ? prev : [...prev, customer]);
    setCustomerId(String(customer.id));
    setCustomerAddress(address);
    setCustomerModalOpen(false);
  }

  function addCustomItem() {
    if (serviceModalIndex === null) return;
    setItems((prev) => prev.map((item, current) => current === serviceModalIndex ? { ...item, productId: undefined } : item));
    setServiceModalIndex(null);
  }

  function handleCreatedService(product: Product) {
    setProducts((prev) => [...prev, product]);
    if (serviceModalIndex !== null) selectProduct(serviceModalIndex, product);
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
      customerId: Number(customerId),
      quoteDate,
      customerAddress: customerAddress || undefined,
      status,
      templateKey,
      validTill,
      notes: notes || undefined,
      termsAndConditions: termsAndConditions || undefined,
      discountAmount: Number(discountAmount),
      discountType,
      discountRate: Number(discountRate),
      adjustmentAmount: Number(adjustmentAmount),
      adjustmentType,
      adjustmentRate: Number(adjustmentRate),
      tdsEnabled,
      tdsRate: Number(tdsRate),
      tcsEnabled,
      tcsRate: Number(tcsRate),
      items: items.map((item) => ({ name: item.name.trim(), productId: item.productId, unit: item.unit, type: item.type, description: item.description, quantity: Number(item.quantity), price: Number(item.price), discountAmount: Number(item.discountAmount), taxRate: Number(item.taxRate) })),
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
            <p className="mt-1 text-sm text-slate-500">Build a proposal with a customer, validity date, and itemized pricing.</p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</span>
              <button type="button" onClick={() => setCustomerModalOpen(true)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-left outline-none transition hover:border-orange-400 focus:border-orange-400">
                {customers.find((customer) => String(customer.id) === customerId)?.customerName ?? 'Select customer'}
              </button>
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Quote date</span>
              <input type="date" value={quoteDate} onChange={(event) => setQuoteDate(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
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
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">PDF template</span>
              <select value={templateKey} onChange={(event) => setTemplateKey(event.target.value as (typeof QUOTE_TEMPLATES)[number]['key'])} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400">
                {QUOTE_TEMPLATES.map((template) => <option key={template.key} value={template.key}>{template.label}</option>)}
              </select>
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
          {metadataError ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{metadataError}</div> : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Quote items</h2>
              <p className="text-sm text-slate-500">Itemized pricing for the proposal sent to the customer.</p>
            </div>
            <button type="button" onClick={addItem} aria-label="Add quote item" title="Add quote item" className="rounded-xl border border-slate-200 p-2 text-xl leading-none font-medium text-slate-700 hover:bg-slate-50">+</button>
          </div>

          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div key={`${index}-${item.name}`} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[1.8fr_0.7fr_0.9fr_1fr_auto] md:items-end">
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Item</span>
                  <button type="button" onClick={() => setServiceModalIndex(index)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left outline-none transition hover:border-orange-400 focus:border-orange-400">{item.name || 'Select service or custom item'}</button>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity</span>
                  <input type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', Number(event.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Rate</span>
                  <input type="number" min="0" step="0.01" value={item.price} onChange={(event) => updateItem(index, 'price', Number(event.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Discount</span>
                  <input type="number" min="0" step="0.01" value={item.discountAmount} onChange={(event) => updateItem(index, 'discountAmount', Number(event.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
                </label>
                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</span><div className="text-sm font-semibold text-slate-900">{formatInr(Math.max(0, quoteLineTotal(item) - item.discountAmount))}</div></div>
                  <button type="button" onClick={() => removeItem(index)} aria-label="Remove item" title="Remove item" className="rounded-xl border border-slate-200 p-2 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={items.length === 1}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col items-end gap-3">
            <label className="flex items-center gap-3 text-sm text-slate-600">Discount <select value={discountType} onChange={(event) => setDiscountType(event.target.value as typeof discountType)} className="rounded-xl border border-slate-200 px-2 py-2"><option value="AMOUNT">Amount</option><option value="PERCENTAGE">%</option></select><input type="number" min="0" max={discountType === 'PERCENTAGE' ? 100 : undefined} step="0.01" value={discountType === 'PERCENTAGE' ? discountRate : discountAmount} onChange={(event) => discountType === 'PERCENTAGE' ? setDiscountRate(Number(event.target.value)) : setDiscountAmount(Number(event.target.value))} className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-right outline-none focus:border-orange-400" /></label>
            <label className="flex items-center gap-3 text-sm text-slate-600">TDS <input type="checkbox" checked={tdsEnabled} onChange={(event) => setTdsEnabled(event.target.checked)} /><input disabled={!tdsEnabled} type="number" min="0" max="100" step="0.01" value={tdsRate} onChange={(event) => setTdsRate(Number(event.target.value))} className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-right outline-none focus:border-orange-400 disabled:bg-slate-100" />%</label>
            <label className="flex items-center gap-3 text-sm text-slate-600">TCS <input type="checkbox" checked={tcsEnabled} onChange={(event) => setTcsEnabled(event.target.checked)} /><input disabled={!tcsEnabled} type="number" min="0" max="100" step="0.01" value={tcsRate} onChange={(event) => setTcsRate(Number(event.target.value))} className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-right outline-none focus:border-orange-400 disabled:bg-slate-100" />%</label>
            <label className="flex items-center gap-3 text-sm text-slate-600">Adjustment <select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as typeof adjustmentType)} className="rounded-xl border border-slate-200 px-2 py-2"><option value="AMOUNT">Amount</option><option value="PERCENTAGE">%</option></select><input type="number" min="0" max={adjustmentType === 'PERCENTAGE' ? 100 : undefined} step="0.01" value={adjustmentType === 'PERCENTAGE' ? adjustmentRate : adjustmentAmount} onChange={(event) => adjustmentType === 'PERCENTAGE' ? setAdjustmentRate(Number(event.target.value)) : setAdjustmentAmount(Number(event.target.value))} className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-right outline-none focus:border-orange-400" /></label>
            <div className="text-sm text-slate-500">Tax {formatInr(taxTotal)} · TDS -{formatInr(tdsAmount)} · TCS {formatInr(tcsAmount)}</div>
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
      <CustomerPickerModal open={customerModalOpen} customers={customers} selectedId={customerId ? Number(customerId) : undefined} loading={metadataLoading} error={metadataError} onClose={() => setCustomerModalOpen(false)} onSelect={selectCustomer} />
      <ServicePickerModal open={serviceModalIndex !== null} products={products} selectedId={serviceModalIndex === null ? undefined : items[serviceModalIndex]?.productId} canCreate={canCreateService} onClose={() => setServiceModalIndex(null)} onSelect={handleCreatedService} onCustom={addCustomItem} />
    </div>
  );
}
