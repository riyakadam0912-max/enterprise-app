'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { usePayments } from '@/hooks/usePayments';
import { formatDate, formatInr, PAYMENT_STATUS_STYLES } from '@/utils/finance';

function StatusBadge({ status }: { status: string }) {
  const cls = PAYMENT_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
}

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const paymentId = Number(params.id);
  const { payments, loading, error } = usePayments();

  const payment = useMemo(
    () => payments.find((entry) => entry.id === paymentId) ?? null,
    [payments, paymentId],
  );

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading payment…</div>;
  }

  if (error || !payment) {
    return <div className="p-6 text-sm text-rose-600">{error ?? 'Payment not found'}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => router.back()} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Ledger detail</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">Payment #{payment.id}</h1>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-500">Invoice {payment.invoice?.invoiceNo ?? `#${payment.invoiceId}`} · Received {formatDate(payment.paymentDate)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/invoices/${payment.invoiceId}`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Open Invoice
            </Link>
            <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => window.print()}>
              Print / Export
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Amount', value: formatInr(payment.amount ?? 0) },
            { label: 'Method', value: payment.paymentMethod ?? '—' },
            { label: 'Status', value: <StatusBadge status={payment.status} /> },
            { label: 'Transaction', value: payment.transactionId ?? '—' },
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
          <h2 className="text-sm font-semibold text-slate-700">Reconciliation details</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gateway provider</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{payment.gatewayProvider ?? 'Offline / manual'}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gateway order</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{payment.gatewayOrderId ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gateway payment ID</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{payment.gatewayPaymentId ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gateway reference</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{payment.gatewayReference ?? '—'}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Settlement status and raw webhook payloads are not persisted by the current backend. When gateway support lands, this panel should show verification state, payload trace, and refund audit metadata.
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Invoice link</h2>
            <p className="mt-2 text-sm text-slate-500">{payment.invoice?.customer ?? 'Unassigned customer'}</p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <Link href={`/dashboard/invoices/${payment.invoiceId}`} className="rounded-xl bg-orange-500 px-4 py-2 text-center font-medium text-white hover:bg-orange-600">
                Open related invoice
              </Link>
              <Link href="/dashboard/payments" className="rounded-xl border border-slate-200 px-4 py-2 text-center font-medium text-slate-700 hover:bg-slate-50">
                Back to ledger
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Audit info</h2>
            <p className="mt-2 text-sm text-slate-500">Created {formatDate(payment.createdAt)}</p>
            <p className="mt-1 text-sm text-slate-500">Stored in INR and linked to invoice #{payment.invoiceId}.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
