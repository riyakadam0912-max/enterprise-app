'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getInvoice, updateInvoice } from '@/api/invoicesApi';

const STATUS_OPTIONS = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED', 'VOIDED'] as const;
const PAYMENT_METHODS = ['Bank Transfer', 'Card', 'Cash', 'Cheque', 'Online', 'UPI', 'Wallet', 'Other'] as const;

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const invoiceId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    invoiceNo: '',
    issueDate: '',
    dueDate: '',
    status: 'DRAFT',
    customer: '',
    totalAmount: '',
    taxAmount: '',
    discount: '',
    paymentMethod: '',
    notes: '',
  });

  useEffect(() => {
    if (!invoiceId) return;
    getInvoice(invoiceId)
      .then((invoice) => {
        setForm({
          invoiceNo: invoice.invoiceNo,
          issueDate: invoice.issueDate ? invoice.issueDate.slice(0, 10) : '',
          dueDate: invoice.dueDate ? invoice.dueDate.slice(0, 10) : '',
          status: invoice.status,
          customer: invoice.customer ?? '',
          totalAmount: String(invoice.totalAmount ?? ''),
          taxAmount: String(invoice.taxAmount ?? ''),
          discount: String(invoice.discount ?? ''),
          paymentMethod: invoice.paymentMethod ?? '',
          notes: invoice.notes ?? '',
        });
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.invoiceNo.trim()) {
      setError('Invoice number is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateInvoice(invoiceId, {
        invoiceNo: form.invoiceNo.trim(),
        issueDate: form.issueDate || undefined,
        dueDate: form.dueDate || undefined,
        status: form.status || undefined,
        customer: form.customer || undefined,
        totalAmount: form.totalAmount ? Number(form.totalAmount) : undefined,
        taxAmount: form.taxAmount ? Number(form.taxAmount) : undefined,
        discount: form.discount ? Number(form.discount) : undefined,
        paymentMethod: form.paymentMethod || undefined,
        notes: form.notes || undefined,
      });
      router.push(`/dashboard/invoices/${invoiceId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading invoice…</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/invoices" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Accounts receivable</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Edit invoice</h1>
            <p className="mt-1 text-sm text-slate-500">Update billing dates, status, payment method, or collection notes.</p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice number</span>
              <input value={form.invoiceNo} onChange={(event) => set('invoiceNo', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</span>
              <input value={form.customer} onChange={(event) => set('customer', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
              <select value={form.status} onChange={(event) => set('status', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400">
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Issue date</span>
              <input type="date" value={form.issueDate} onChange={(event) => set('issueDate', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Due date</span>
              <input type="date" value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Payment method</span>
              <select value={form.paymentMethod} onChange={(event) => set('paymentMethod', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400">
                <option value="">Not set</option>
                {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Total amount</span>
              <input type="number" min="0" step="0.01" value={form.totalAmount} onChange={(event) => set('totalAmount', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Tax amount</span>
              <input type="number" min="0" step="0.01" value={form.taxAmount} onChange={(event) => set('taxAmount', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Discount</span>
              <input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => set('discount', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
            </label>
          </div>

          <label className="mt-4 block space-y-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span>
            <textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-orange-400" />
          </label>

          {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div> : null}
        </section>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => router.push('/dashboard/invoices')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60">
            {saving ? 'Saving…' : 'Update Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}
