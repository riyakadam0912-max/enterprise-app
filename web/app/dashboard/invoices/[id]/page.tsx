'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { getInvoice, type Invoice } from '@/api/invoicesApi';
import {
  INVOICE_STATUS_STYLES,
  formatDate,
  formatInr,
  invoiceOutstanding,
  normalizeInvoiceStatus,
} from '@/utils/finance';
import { useEffect, useState } from 'react';

function StatusBadge({ status }: { status: string }) {
  const cls = INVOICE_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const invoiceId = Number(params.id);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    getInvoice(invoiceId)
      .then(setInvoice)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  const summary = useMemo(() => {
    const payments = invoice?.payments ?? [];
    const paid = payments.reduce((total, payment) => total + (payment.status === 'REFUNDED' ? -payment.amount : payment.amount), 0);
    const outstanding = invoice ? invoiceOutstanding(invoice.totalAmount ?? 0, payments) : 0;
    return { paid, outstanding, payments };
  }, [invoice]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading invoice…</div>;
  }

  if (error || !invoice) {
    return <div className="p-6 text-sm text-rose-600">{error ?? 'Invoice not found'}</div>;
  }

  const status = normalizeInvoiceStatus(invoice.status);
  const agingDays = invoice.dueDate ? Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Receivables detail</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">Invoice {invoice.invoiceNo}</h1>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Customer {invoice.customer ?? 'Unassigned'} · Due {formatDate(invoice.dueDate)} · Issued {formatDate(invoice.issueDate)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/invoices/${invoice.id}/edit`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Edit
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Print / Download
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white opacity-60"
              title="Gateway checkout is not connected in the current backend"
            >
              Pay Now
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Status', value: <StatusBadge status={status} /> },
            { label: 'Total', value: formatInr(invoice.totalAmount ?? 0) },
            { label: 'Paid', value: formatInr(summary.paid) },
            { label: 'Outstanding', value: formatInr(summary.outstanding) },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Invoice summary</h2>
            <span className="text-xs text-slate-400">Aging: {agingDays === null ? '—' : `${agingDays} days`}</span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{invoice.customer ?? 'Not assigned'}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment method</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{invoice.paymentMethod ?? 'Not set'}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issue date</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{formatDate(invoice.issueDate)}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due date</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{formatDate(invoice.dueDate)}</p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Line item</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Unit</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">Invoice total</td>
                  <td className="px-4 py-3 text-center text-slate-500">1</td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatInr(invoice.totalAmount ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatInr(invoice.totalAmount ?? 0)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-100">
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Subtotal</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{formatInr(invoice.totalAmount ?? 0)}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Tax</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{formatInr(invoice.taxAmount ?? 0)}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Discount</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{formatInr(invoice.discount ?? 0)}</td>
                </tr>
                <tr className="border-t border-slate-100 bg-slate-50">
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Balance due</td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-slate-900">{formatInr(summary.outstanding)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Gateway readiness</h2>
            <p className="mt-2 text-sm text-slate-500">Online checkout is not wired to the backend yet. When the payment order endpoint lands, this is where the invoice will open Razorpay or Cashfree checkout.</p>
            <div className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
              Backend gap: payment order, webhook verification, and gateway metadata storage still need to be added.
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Payment history</h2>
            <div className="mt-4 space-y-3">
              {summary.payments.length === 0 ? (
                <p className="text-sm text-slate-400">No payments recorded yet.</p>
              ) : (
                summary.payments.map((payment) => (
                  <div key={payment.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{formatInr(payment.amount)}</p>
                        <p className="text-xs text-slate-500">{payment.paymentMethod} · {formatDate(payment.paymentDate)}</p>
                      </div>
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{payment.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Transaction: {payment.transactionId ?? '—'}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{invoice.notes ?? 'No notes captured.'}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
