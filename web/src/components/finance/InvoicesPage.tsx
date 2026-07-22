'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createPayment } from '@/api/paymentsApi';
import { createInvoice, getInvoices, updateInvoice, sendInvoice, type Invoice } from '@/api/invoicesApi';
import { useAuthSession } from '@/stores/auth-store';
import { formatDate, formatInr, invoiceOutstanding, normalizeInvoiceStatus } from '@/utils/finance';

type DashboardRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

type InvoiceUiStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';
type InvoiceFormStatus = 'DRAFT' | 'SENT';
type InvoiceFormState = {
  clientName: string;
  clientEmail: string;
  issueDate: string;
  dueDate: string;
  amount: string;
  taxPercent: string;
  notes: string;
  status: InvoiceFormStatus;
};

type SessionState = DashboardRole | 'UNAUTHENTICATED' | null;

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function currency(value: number) {
  return formatInr(value, 0);
}

function getStatusClass(status: InvoiceUiStatus) {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
    case 'SENT':
      return 'bg-sky-100 text-sky-700 ring-1 ring-sky-200';
    case 'PAID':
      return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
    case 'OVERDUE':
      return 'bg-rose-100 text-rose-700 ring-1 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  }
}

function paymentAmount(payment: NonNullable<Invoice['payments']>[number]) {
  const status = (payment.status ?? '').toUpperCase();
  if (status === 'FAILED') return 0;
  if (status === 'REFUNDED') return -payment.amount;
  return payment.amount;
}

function invoicePaidAmount(invoice: Invoice) {
  return (invoice.payments ?? []).reduce((sum, payment) => sum + paymentAmount(payment), 0);
}

function invoiceUiStatus(invoice: Invoice): InvoiceUiStatus {
  const status = normalizeInvoiceStatus(invoice.status);
  const outstanding = invoiceOutstanding(invoice.totalAmount ?? 0, invoice.payments ?? []);
  const isOverdue = Boolean(invoice.dueDate && new Date(invoice.dueDate).getTime() < Date.now() && outstanding > 0);

  if (status === 'PAID') return 'PAID';
  if (isOverdue && ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(status)) return 'OVERDUE';
  if (status === 'DRAFT') return 'DRAFT';
  return 'SENT';
}

function invoiceRowLabel(invoice: Invoice) {
  return `INV-${String(invoice.id).padStart(3, '0')}`;
}

function parseNotes(notes?: string | null) {
  const text = notes?.trim() ?? '';
  if (!text) return { clientEmail: '', body: '' };

  const lines = text.split(/\r?\n/);
  const body: string[] = [];
  let clientEmail = '';

  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized) {
      body.push('');
      continue;
    }
    if (normalized.toLowerCase().startsWith('client email:')) {
      clientEmail = normalized.slice('client email:'.length).trim();
      continue;
    }
    body.push(line);
  }

  return { clientEmail, body: body.join('\n').trim() };
}

function composeNotes(clientEmail: string, body: string) {
  const segments: string[] = [];
  if (clientEmail.trim()) segments.push(`Client email: ${clientEmail.trim()}`);
  if (body.trim()) segments.push(body.trim());
  return segments.join('\n');
}

function nextInvoiceNumber(invoices: Invoice[]) {
  const next = invoices.reduce((max, invoice) => {
    const match = invoice.invoiceNo?.match(/(\d+)$/);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, invoices.length);
  return `INV-${String(next + 1).padStart(3, '0')}`;
}

function paymentTerms(invoice: Invoice) {
  if (invoice.issueDate && invoice.dueDate) {
    const issue = new Date(invoice.issueDate).getTime();
    const due = new Date(invoice.dueDate).getTime();
    if (Number.isFinite(issue) && Number.isFinite(due)) {
      const days = Math.max(0, Math.round((due - issue) / (1000 * 60 * 60 * 24)));
      return `Net ${days} days`;
    }
  }
  return invoice.dueDate ? `Due ${formatDate(invoice.dueDate)}` : 'Due on issue';
}

function lineItemDescription(invoice: Invoice, parsedNotes: { body: string }) {
  return parsedNotes.body || invoice.notes?.trim() || invoice.customer || 'Invoice total';
}

function EyeIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 12s3.5-7 10.5-7 10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
}

function SendIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M15 17H5a4 4 0 0 1 0-8h.5A6.5 6.5 0 0 1 18 7.5V9a4 4 0 0 0 4 4v1h-4" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>;
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
}

function XIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>;
}

function DrawerShell({ children, onClose, widthClass = 'max-w-[380px]' }: { children: React.ReactNode; onClose: () => void; widthClass?: string }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed inset-0 z-50 flex justify-end p-4 sm:p-6">
        <div className={`flex h-full w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 ${widthClass}`}>
          {children}
        </div>
      </aside>
    </>
  );
}

function StatusBadge({ status }: { status: InvoiceUiStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(status)}`}>{status}</span>;
}

export default function InvoicesPage() {
  const auth = useAuthSession();
  const sessionRole: SessionState = auth.user || auth.employeeId != null ? auth.role : 'UNAUTHENTICATED';
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE'>('ALL');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceFormState>({
    clientName: '',
    clientEmail: '',
    issueDate: todayInputValue(),
    dueDate: todayInputValue(),
    amount: '',
    taxPercent: '0',
    notes: '',
    status: 'DRAFT' as InvoiceFormStatus,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const rows = await getInvoices();
        if (!active) return;
        setInvoices(rows);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load invoices');
      } finally {
        if (active) setLoading(false);
      }
    }

    if (sessionRole !== null) {
      void load();
    }

    return () => {
      active = false;
    };
  }, [sessionRole]);

  const canManageInvoices = sessionRole === 'ADMIN' || sessionRole === 'HR';
  const selectedInvoice = useMemo(() => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null, [invoices, selectedInvoiceId]);

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const uiStatus = invoiceUiStatus(invoice);
      const matchesSearch = invoice.invoiceNo.toLowerCase().includes(query) || (invoice.customer ?? '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || uiStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const selectedParsedNotes = useMemo(() => parseNotes(selectedInvoice?.notes), [selectedInvoice?.notes]);

  async function handleInvoiceAction(invoice: Invoice, action: 'send' | 'sent' | 'paid' | 'record-payment') {
    try {
      setActionLoadingId(invoice.id);
      setMessage(null);
      setError(null);

      if (action === 'send') {
        const parsed = parseNotes(invoice.notes);
        const to = invoice.clientEmail || parsed.clientEmail;
        if (!to) {
          setError('No client email stored on this invoice.');
          return;
        }
        await sendInvoice(invoice.id, { to });
        // Refresh the invoice list to get updated status
        const rows = await getInvoices();
        setInvoices(rows);
        setMessage('Invoice sent successfully');
        return;
      }

      if (action === 'sent') {
        const updated = await updateInvoice(invoice.id, { status: 'ISSUED' });
        setInvoices((prev) => prev.map((row) => (row.id === invoice.id ? updated : row)));
        setMessage('Invoice marked as sent');
        return;
      }

      const remainingAmount = invoiceOutstanding(invoice.totalAmount ?? 0, invoice.payments ?? []);
      const paymentAmountValue = remainingAmount > 0 ? remainingAmount : invoice.totalAmount ?? 0;
      const payment = await createPayment({
        invoiceId: invoice.id,
        amount: paymentAmountValue,
        paymentMethod: invoice.paymentMethod ?? 'Bank Transfer',
        paymentDate: new Date().toISOString().slice(0, 10),
        status: 'COMPLETED',
      });

      const updated = await updateInvoice(invoice.id, { status: 'PAID' });
      setInvoices((prev) => prev.map((row) => (row.id === invoice.id ? { ...updated, payments: [payment, ...(updated.payments ?? [])] } : row)));
      setMessage(action === 'record-payment' ? 'Payment recorded' : 'Invoice marked as paid');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to update invoice');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleCreateInvoice() {
    try {
      setActionLoadingId(-1);
      setMessage(null);
      setError(null);

      const amount = Number(form.amount);
      const taxPercent = Number(form.taxPercent || 0);
      const taxAmount = Number.isFinite(amount) ? (amount * taxPercent) / 100 : 0;
      const totalAmount = (Number.isFinite(amount) ? amount : 0) + taxAmount;
      const created = await createInvoice({
        invoiceNo: nextInvoiceNumber(invoices),
        customer: form.clientName.trim(),
        clientEmail: form.clientEmail.trim(),
        issueDate: form.issueDate || undefined,
        dueDate: form.dueDate || undefined,
        status: form.status === 'SENT' ? 'ISSUED' : 'DRAFT',
        totalAmount,
        taxAmount,
        notes: composeNotes(form.clientEmail, form.notes),
      });

      setInvoices((prev) => [created, ...prev]);
      setForm({
        clientName: '',
        clientEmail: '',
        issueDate: todayInputValue(),
        dueDate: todayInputValue(),
        amount: '',
        taxPercent: '0',
        notes: '',
        status: 'DRAFT',
      });
      setShowCreateDrawer(false);
      setMessage('Invoice created successfully');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create invoice');
    } finally {
      setActionLoadingId(null);
    }
  }

  function openReminder(invoice: Invoice) {
    const parsed = parseNotes(invoice.notes);
    if (!parsed.clientEmail) {
      setError('No client email stored on this invoice.');
      return;
    }

    const subject = encodeURIComponent(`Payment reminder for ${invoice.invoiceNo}`);
    const body = encodeURIComponent(`Hello ${invoice.customer ?? 'Client'},\n\nThis is a reminder that invoice ${invoice.invoiceNo} is due.\n\nRegards,`);
    window.location.href = `mailto:${parsed.clientEmail}?subject=${subject}&body=${body}`;
  }

  if (sessionRole === 'UNAUTHENTICATED') {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Invoices is available to Admin and HR users only.</div>
      </div>
    );
  }

  const selectedStatus = selectedInvoice ? invoiceUiStatus(selectedInvoice) : null;
  const lineSubtotal = selectedInvoice ? Math.max(0, (selectedInvoice.totalAmount ?? 0) - (selectedInvoice.taxAmount ?? 0) + (selectedInvoice.discount ?? 0)) : 0;
  const selectedOutstanding = selectedInvoice ? invoiceOutstanding(selectedInvoice.totalAmount ?? 0, selectedInvoice.payments ?? []) : 0;

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">Accounts receivable</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Invoices</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Track billing, due dates, payments, and invoice status in one clean workspace.</p>
          </div>
          {canManageInvoices ? (
            <button
              type="button"
              onClick={() => setShowCreateDrawer(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <PlusIcon />
              New invoice
            </button>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-2xl flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search client name or invoice number"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'DRAFT', 'SENT', 'PAID', 'OVERDUE'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === filter ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {filter === 'ALL' ? 'All' : filter.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </section>

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading invoices…</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-400">No invoices match the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice #</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Client</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Issue date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Due date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((invoice) => {
                  const uiStatus = invoiceUiStatus(invoice);
                  const overdue = uiStatus === 'OVERDUE';
                  const canAct = canManageInvoices;
                  const paidAmount = invoicePaidAmount(invoice);
                  const outstanding = invoiceOutstanding(invoice.totalAmount ?? 0, invoice.payments ?? []);

                  return (
                    <tr
                      key={invoice.id}
                      onClick={() => setSelectedInvoiceId(invoice.id)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-medium text-slate-900">{invoiceRowLabel(invoice)}</td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{invoice.customer ?? 'Unassigned client'}</div>
                        <div className="text-xs text-slate-500">Paid {currency(paidAmount)} · Outstanding {currency(outstanding)}</div>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-900">{currency(invoice.totalAmount ?? 0)}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(invoice.issueDate)}</td>
                      <td className={`px-5 py-4 ${overdue ? 'font-medium text-rose-600' : 'text-slate-600'}`}>{formatDate(invoice.dueDate)}</td>
                      <td className="px-5 py-4"><StatusBadge status={uiStatus} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="Open invoice"
                            aria-label="Open invoice"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedInvoiceId(invoice.id);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                          >
                            <EyeIcon />
                          </button>
                          {canAct && uiStatus === 'DRAFT' ? (
                            <button
                              type="button"
                              title="Send invoice"
                              aria-label="Send invoice"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleInvoiceAction(invoice, 'send');
                              }}
                              disabled={actionLoadingId === invoice.id}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                            >
                              <SendIcon />
                            </button>
                          ) : null}
                          {canAct && uiStatus === 'SENT' ? (
                            <button
                              type="button"
                              title="Mark paid"
                              aria-label="Mark paid"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleInvoiceAction(invoice, 'paid');
                              }}
                              disabled={actionLoadingId === invoice.id}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <CheckIcon />
                            </button>
                          ) : null}
                          {canAct && uiStatus === 'OVERDUE' ? (
                            <>
                              <button
                                type="button"
                                title="Record payment"
                                aria-label="Record payment"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleInvoiceAction(invoice, 'record-payment');
                                }}
                                disabled={actionLoadingId === invoice.id}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-amber-600 transition hover:bg-amber-50 disabled:opacity-50"
                              >
                                <ClockIcon />
                              </button>
                              <button
                                type="button"
                                title="Send reminder"
                                aria-label="Send reminder"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openReminder(invoice);
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                              >
                                <BellIcon />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-400">
          <span>Showing {filteredInvoices.length} of {invoices.length}</span>
          <Link href="/dashboard/invoices" className="font-medium text-blue-600 hover:underline">View all invoices</Link>
        </div>
      </section>

      {selectedInvoice ? (
        <DrawerShell onClose={() => setSelectedInvoiceId(null)}>
          <div className="flex items-start justify-between border-b border-slate-200 bg-linear-to-r from-white to-slate-50 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice detail</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">{invoiceRowLabel(selectedInvoice)}</h2>
            </div>
            <button type="button" onClick={() => setSelectedInvoiceId(null)} className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50" aria-label="Close invoice details">
              <XIcon />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Bill to</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{selectedInvoice.customer ?? 'Unassigned client'}</p>
                {selectedParsedNotes.clientEmail ? <p className="text-sm text-slate-600">{selectedParsedNotes.clientEmail}</p> : null}
              </div>
              <StatusBadge status={selectedStatus ?? 'DRAFT'} />
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Issue date</span><span>{formatDate(selectedInvoice.issueDate)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Due date</span><span className={selectedStatus === 'OVERDUE' ? 'font-medium text-rose-600' : ''}>{formatDate(selectedInvoice.dueDate)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Payment terms</span><span>{paymentTerms(selectedInvoice)}</span></div>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900">Line items</h3>
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-4 py-3 text-slate-700">{lineItemDescription(selectedInvoice, selectedParsedNotes)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">1</td>
                      <td className="px-4 py-3 text-right text-slate-700">{currency(lineSubtotal)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{currency(lineSubtotal)}</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-50 text-sm">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right text-slate-500">Subtotal</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{currency(lineSubtotal)}</td>
                    </tr>
                    {selectedInvoice.discount ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right text-slate-500">Discount</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">-{currency(selectedInvoice.discount ?? 0)}</td>
                      </tr>
                    ) : null}
                    {selectedInvoice.taxAmount ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right text-slate-500">Tax</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">{currency(selectedInvoice.taxAmount ?? 0)}</td>
                      </tr>
                    ) : null}
                    <tr className="border-t border-slate-200">
                      <td colSpan={3} className="px-4 py-3 text-right text-base font-semibold text-slate-900">Total</td>
                      <td className="px-4 py-3 text-right text-base font-semibold text-slate-900">{currency(selectedInvoice.totalAmount ?? 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {selectedParsedNotes.body ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selectedParsedNotes.body}</div>
              </div>
            ) : null}

            {selectedInvoice.payments?.length ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900">Payments</h3>
                <div className="mt-2 space-y-2">
                  {selectedInvoice.payments.map((payment) => (
                    <div key={payment.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <span>{formatDate(payment.paymentDate)}</span>
                        <span className="font-medium text-slate-900">{currency(payment.amount)}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{payment.paymentMethod} · {payment.status}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm text-slate-500">Outstanding: <span className="font-semibold text-slate-900">{currency(selectedOutstanding)}</span></p>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200 px-5 py-4">
            {canManageInvoices ? (
              <div className="space-y-3">
                {selectedStatus === 'DRAFT' ? (
                  <button
                    type="button"
                    onClick={() => void handleInvoiceAction(selectedInvoice, 'send')}
                    disabled={actionLoadingId === selectedInvoice.id}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    Send invoice
                  </button>
                ) : null}
                {selectedStatus === 'SENT' ? (
                  <button
                    type="button"
                    onClick={() => void handleInvoiceAction(selectedInvoice, 'paid')}
                    disabled={actionLoadingId === selectedInvoice.id}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Mark as paid
                  </button>
                ) : null}
                {selectedStatus === 'OVERDUE' ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handleInvoiceAction(selectedInvoice, 'record-payment')}
                      disabled={actionLoadingId === selectedInvoice.id}
                      className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                    >
                      Record payment
                    </button>
                    <button
                      type="button"
                      onClick={() => openReminder(selectedInvoice)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Send reminder
                    </button>
                  </div>
                ) : null}
                {selectedStatus === 'PAID' ? (
                  <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Paid ✓</div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">Read-only access</div>
            )}
          </div>
        </DrawerShell>
      ) : null}

      {showCreateDrawer ? (
        <DrawerShell onClose={() => setShowCreateDrawer(false)}>
          <div className="flex items-start justify-between border-b border-slate-200 bg-linear-to-r from-white to-slate-50 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Create invoice</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">New invoice</h2>
            </div>
            <button type="button" onClick={() => setShowCreateDrawer(false)} className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50" aria-label="Close new invoice drawer">
              <XIcon />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Invoice number will be generated automatically as <span className="font-semibold">{nextInvoiceNumber(invoices)}</span>.
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Client name</span>
                <input
                  value={form.clientName}
                  onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  placeholder="Acme Pvt Ltd"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Client email</span>
                <input
                  type="email"
                  value={form.clientEmail}
                  onChange={(event) => setForm((current) => ({ ...current, clientEmail: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  placeholder="billing@client.com"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Issue date</span>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Due date</span>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Amount</span>
                  <div className="flex items-center rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-blue-400">
                    <span className="text-sm text-slate-400">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                      className="ml-2 w-full border-0 bg-transparent p-0 text-sm outline-none"
                      placeholder="25000"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Tax %</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.taxPercent}
                    onChange={(event) => setForm((current) => ({ ...current, taxPercent: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                    placeholder="0"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Description / notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={5}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  placeholder="Project billing details, scope notes, or special instructions"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as InvoiceFormStatus }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                </select>
              </label>
            </div>
          </div>
          <div className="border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={() => void handleCreateInvoice()}
              disabled={actionLoadingId === -1 || !form.clientName.trim() || !form.dueDate || !form.amount}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              Create invoice
            </button>
          </div>
        </DrawerShell>
      ) : null}
    </div>
  );
}
