'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getInvoicesByStatus, type Invoice } from '../../../../src/api/invoicesApi';
import { formatInr } from '@/utils/finance';

const COLUMNS = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'ISSUED', label: 'Issued' },
  { key: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { key: 'PAID', label: 'Paid' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'REFUNDED', label: 'Refunded' },
  { key: 'VOIDED', label: 'Voided' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InvoiceStatusesPage() {
  const [grouped, setGrouped] = useState<Record<string, Invoice[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInvoicesByStatus()
      .then(setGrouped)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Receivables workflow</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Invoice status board</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">A quick visual read on what is draft, issued, overdue, settled, or voided across the invoice lifecycle.</p>
        <div className="mt-4">
          <Link href="/dashboard/invoices" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back to list</Link>
        </div>
      </section>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => {
          const cards = grouped[column.key] ?? [];
          return (
            <div key={column.key} className="w-72 shrink-0 rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
              <div className="rounded-t-3xl border-b border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{column.label}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{cards.length}</span>
                </div>
              </div>
              <div className="max-h-[calc(100vh-240px)] space-y-2 overflow-y-auto p-3">
                {cards.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-8 text-center text-xs text-slate-400">No invoices in {column.label}</div>
                ) : (
                  cards.map((invoice) => (
                    <Link key={invoice.id} href={`/dashboard/invoices/${invoice.id}`} className="block rounded-2xl border border-slate-200 bg-white p-3 transition hover:shadow-md">
                      <p className="text-sm font-semibold text-slate-900 truncate">{invoice.invoiceNo}</p>
                      <p className="mt-1 text-xs text-slate-500 truncate">{invoice.customer ?? 'Unassigned customer'}</p>
                      <p className="mt-2 text-xs text-slate-500">Due {fmt(invoice.dueDate)}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-700">{formatInr(invoice.totalAmount ?? 0)}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
