'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { addPayment, usePayments } from '@/hooks/usePayments';
import { getInvoices, type Invoice } from '@/api/invoicesApi';
import { reportError } from '@/lib/error-handling';
import { formatDate, formatInr, PAYMENT_STATUS_STYLES } from '@/utils/finance';

const STATUS_FILTERS = ['ALL', 'COMPLETED', 'PENDING', 'FAILED', 'REFUNDED', 'RECONCILED', 'PARTIALLY_SETTLED'] as const;
const METHOD_FILTERS = ['ALL', 'Bank Transfer', 'Card', 'Cash', 'Cheque', 'Online', 'UPI', 'Wallet', 'Other'] as const;

function StatusBadge({ status }: { status: string }) {
  const cls = PAYMENT_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
}

export default function PaymentsPage() {
  const { payments, loading, error, refetch } = usePayments();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState<(typeof METHOD_FILTERS)[number]>('ALL');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    invoiceId: '',
    amount: '',
    paymentMethod: 'Bank Transfer',
    transactionId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    status: 'COMPLETED',
  });

  useEffect(() => {
    async function loadInvoices() {
      try {
        setInvoices(await getInvoices());
      } catch (error) {
        reportError(error, 'Unable to load invoices');
      }
    }

    loadInvoices();
  }, []);

  const paymentStats = useMemo(() => {
    const collected = payments.reduce((sum, payment) => (payment.status === 'REFUNDED' ? sum - payment.amount : sum + payment.amount), 0);
    return {
      total: payments.length,
      collected,
      pending: payments.filter((payment) => payment.status === 'PENDING').length,
      failed: payments.filter((payment) => payment.status === 'FAILED').length,
      refunded: payments.filter((payment) => payment.status === 'REFUNDED').length,
      reconciled: payments.filter((payment) => payment.status === 'RECONCILED').length,
    };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesSearch =
        payment.invoice?.invoiceNo.toLowerCase().includes(query) ||
        (payment.invoice?.customer ?? '').toLowerCase().includes(query) ||
        payment.paymentMethod.toLowerCase().includes(query) ||
        (payment.transactionId ?? '').toLowerCase().includes(query) ||
        (payment.gatewayPaymentId ?? '').toLowerCase().includes(query) ||
        payment.status.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || payment.status === statusFilter;
      const matchesMethod = methodFilter === 'ALL' || payment.paymentMethod === methodFilter;
      const matchesInvoice = invoiceFilter === 'ALL' || String(payment.invoiceId) === invoiceFilter;
      return matchesSearch && matchesStatus && matchesMethod && matchesInvoice;
    });
  }, [payments, search, statusFilter, methodFilter, invoiceFilter]);

  function handle(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.invoiceId || !form.amount) {
      setSaveErr('Invoice and amount are required.');
      return;
    }

    setSaving(true);
    setSaveErr(null);
    try {
      await addPayment({
        invoiceId: Number(form.invoiceId),
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        transactionId: form.transactionId || undefined,
        paymentDate: form.paymentDate,
        status: form.status,
      });
      setShowModal(false);
      await refetch();
    } catch (err: unknown) {
      setSaveErr(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Ledger & reconciliation</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Payments</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Capture manual receipts, inspect gateway metadata, and reconcile collections against invoices in one finance ledger.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-orange-200 transition-colors hover:bg-orange-600"
          >
            <span className="text-base leading-none">+</span>
            Record Payment
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {[
            { label: 'Total payments', value: paymentStats.total },
            { label: 'Collected amount', value: formatInr(paymentStats.collected) },
            { label: 'Pending', value: paymentStats.pending },
            { label: 'Failed', value: paymentStats.failed },
            { label: 'Refunded', value: paymentStats.refunded },
            { label: 'Reconciled', value: paymentStats.reconciled },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <div className="relative lg:col-span-2">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice, customer, payment method, transaction or gateway reference..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-orange-400"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <select value={invoiceFilter} onChange={(event) => setInvoiceFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400">
              <option value="ALL">All invoices</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>{invoice.invoiceNo}</option>
              ))}
            </select>
            <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value as (typeof METHOD_FILTERS)[number])} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400">
              {METHOD_FILTERS.map((method) => <option key={method} value={method}>{method === 'ALL' ? 'All methods' : method}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === status ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {status === 'ALL' ? 'All statuses' : status.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      </section>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading payments…</div>
        ) : error ? (
          <div className="py-20 text-center text-sm text-rose-600">{error}</div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-400">No payments match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Method</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Transaction</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Gateway</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{payment.invoice?.invoiceNo ?? `#${payment.invoiceId}`}</div>
                      <div className="text-xs text-slate-500">{payment.invoice?.status ?? 'Unknown invoice status'}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{payment.invoice?.customer ?? 'Unassigned customer'}</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-900">{formatInr(payment.amount ?? 0)}</td>
                    <td className="px-5 py-4 text-slate-700">{payment.paymentMethod}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{payment.transactionId ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-500">{payment.gatewayProvider ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-500">{formatDate(payment.paymentDate)}</td>
                    <td className="px-5 py-4"><StatusBadge status={payment.status} /></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/dashboard/payments/${payment.id}`} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                          Open
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Record payment</h2>
                <p className="mt-1 text-sm text-slate-500">Enter an offline or manual receipt to reconcile it against an invoice.</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
            </div>

            {saveErr ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{saveErr}</div> : null}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice</label>
                <select name="invoiceId" value={form.invoiceId} onChange={handle} required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400">
                  <option value="">Select invoice</option>
                  {invoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>{invoice.invoiceNo} · {invoice.customer ?? 'N/A'} · {formatInr(invoice.totalAmount ?? 0)}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</label>
                  <input name="amount" type="number" step="0.01" min="0" value={form.amount} onChange={handle} required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Payment date</label>
                  <input name="paymentDate" type="date" value={form.paymentDate} onChange={handle} required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Method</label>
                  <select name="paymentMethod" value={form.paymentMethod} onChange={handle} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400">
                    {METHOD_FILTERS.filter((method) => method !== 'ALL').map((method) => <option key={method} value={method}>{method}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                  <select name="status" value={form.status} onChange={handle} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400">
                    {STATUS_FILTERS.filter((status) => status !== 'ALL').map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Transaction ID</label>
                <input name="transactionId" value={form.transactionId} onChange={handle} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60">{saving ? 'Saving…' : 'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
