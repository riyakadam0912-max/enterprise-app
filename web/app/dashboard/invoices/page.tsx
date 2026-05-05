'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { deleteInvoice, getInvoices, type Invoice } from '@/api/invoicesApi';
import TableActions from '@/components/common/TableActions';
import {
  INVOICE_STATUS_STYLES,
  formatDate,
  formatInr,
  invoiceOutstanding,
  normalizeInvoiceStatus,
} from '@/utils/finance';

const FILTERS = ['ALL', 'DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED', 'VOIDED'] as const;

function StatusBadge({ status }: { status: string }) {
  const cls = INVOICE_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    getInvoices()
      .then(setInvoices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const invoiceStats = useMemo(() => {
    const totalOutstanding = invoices.reduce((sum, invoice) => {
      const paidAmount = invoice.payments?.reduce((paymentTotal, payment) => paymentTotal + (payment.status === 'REFUNDED' ? -payment.amount : payment.amount), 0) ?? 0;
      return sum + Math.max(0, invoice.totalAmount - paidAmount);
    }, 0);

    return {
      total: invoices.length,
      draft: invoices.filter((invoice) => normalizeInvoiceStatus(invoice.status) === 'DRAFT').length,
      issued: invoices.filter((invoice) => normalizeInvoiceStatus(invoice.status) === 'ISSUED').length,
      paid: invoices.filter((invoice) => normalizeInvoiceStatus(invoice.status) === 'PAID').length,
      overdue: invoices.filter((invoice) => normalizeInvoiceStatus(invoice.status) === 'OVERDUE').length,
      outstanding: totalOutstanding,
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const status = normalizeInvoiceStatus(invoice.status);
      const matchesSearch =
        invoice.invoiceNo.toLowerCase().includes(query) ||
        (invoice.customer ?? '').toLowerCase().includes(query) ||
        (invoice.paymentMethod ?? '').toLowerCase().includes(query) ||
        status.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  async function handleDelete(id: number) {
    try {
      await deleteInvoice(id);
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== id));
    } catch {
      alert('Failed to delete invoice.');
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Accounts receivable</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Invoices</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Track receivables by lifecycle, due date, and balance so finance teams can see what is issued, paid, overdue, and still outstanding.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/invoices/add" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-orange-200 transition-colors hover:bg-orange-600">
              <span className="text-base leading-none">+</span>
              New Invoice
            </Link>
            <Link href="/dashboard/invoices/statuses" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Status Board
            </Link>
            <TableActions moduleKey="invoices" rows={filteredInvoices} onRefresh={() => getInvoices().then(setInvoices)} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Total invoices', value: invoiceStats.total },
            { label: 'Draft', value: invoiceStats.draft },
            { label: 'Issued', value: invoiceStats.issued },
            { label: 'Paid', value: invoiceStats.paid },
            { label: 'Outstanding', value: formatInr(invoiceStats.outstanding) },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-2xl flex-1">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice number, customer, payment method..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-orange-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === filter ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {filter === 'ALL' ? 'All' : filter.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading invoices…</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-400">No invoices match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Due</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Paid</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Outstanding</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((invoice) => {
                  const status = normalizeInvoiceStatus(invoice.status);
                  const paidAmount = invoice.payments?.reduce((paymentTotal, payment) => paymentTotal + (payment.status === 'REFUNDED' ? -payment.amount : payment.amount), 0) ?? 0;
                  const outstanding = invoiceOutstanding(invoice.totalAmount ?? 0, invoice.payments ?? []);
                  const dueDateLabel = formatDate(invoice.dueDate);

                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{invoice.invoiceNo}</div>
                        <div className="text-xs text-slate-500">Issued {formatDate(invoice.issueDate)}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <div className="font-medium">{invoice.customer ?? 'Unassigned customer'}</div>
                        <div className="text-xs text-slate-500">{invoice.paymentMethod ?? 'No payment method set'}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <div>{dueDateLabel}</div>
                        <div className="text-xs text-slate-400">{status === 'OVERDUE' ? 'Needs follow-up' : 'On schedule'}</div>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-900">{formatInr(invoice.totalAmount ?? 0)}</td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-700">{formatInr(paidAmount)}</td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-900">{formatInr(outstanding)}</td>
                      <td className="px-5 py-4"><StatusBadge status={status} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/dashboard/invoices/${invoice.id}`} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                            Open
                          </Link>
                          <Link href={`/dashboard/invoices/${invoice.id}/edit`} className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteId(invoice.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">Delete invoice</h2>
            <p className="mt-2 text-sm text-slate-500">This removes the invoice record from the dashboard. Use this only for true mistakes.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteId(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={() => void handleDelete(deleteId)} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
