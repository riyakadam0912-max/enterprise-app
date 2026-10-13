"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Bell,
  Check,
  Eye,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { createPayment } from "@/api/paymentsApi";
import {
  deleteInvoice,
  getInvoices,
  sendInvoice,
  updateInvoice,
  type Invoice,
} from "@/api/invoicesApi";
import { isSuperAdminSession, useAuthSession } from "@/stores/auth-store";
import {
  formatDate,
  formatInr,
  invoiceOutstanding,
  normalizeInvoiceStatus,
} from "@/utils/finance";

type DashboardRole = "SUPER_ADMIN" | "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE";
type InvoiceStatusFilter =
  | "ALL"
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE";
type SessionState = DashboardRole | "UNAUTHENTICATED" | null;

const FILTERS: InvoiceStatusFilter[] = [
  "ALL",
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
];

function invoiceStatus(invoice: Invoice): string {
  const status = normalizeInvoiceStatus(invoice.status);
  const outstanding = invoiceOutstanding(
    invoice.totalAmount ?? 0,
    invoice.payments ?? [],
  );
  const pastDue = Boolean(
    invoice.dueDate && new Date(invoice.dueDate).getTime() < Date.now(),
  );
  if (
    pastDue &&
    outstanding > 0 &&
    ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(status)
  )
    return "OVERDUE";
  return status;
}

function statusClass(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
    case "ISSUED":
      return "bg-sky-100 text-sky-700 ring-1 ring-sky-200";
    case "PARTIALLY_PAID":
      return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
    case "PAID":
      return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
    case "OVERDUE":
      return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }
}

function parseClientEmail(notes?: string | null) {
  const line = notes
    ?.split(/\r?\n/)
    .find((entry) => entry.trim().toLowerCase().startsWith("client email:"));
  return line?.slice(line.indexOf(":") + 1).trim() ?? "";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function InvoicesPage() {
  const auth = useAuthSession();
  const role: SessionState =
    auth.user || auth.employeeId != null ? auth.role : "UNAUTHENTICATED";
  const canManage = isSuperAdminSession(auth) || role === "ADMIN";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvoices(await getInvoices());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load invoices.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role && role !== "UNAUTHENTICATED") void refreshInvoices();
  }, [refreshInvoices, role]);

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const status = invoiceStatus(invoice);
      const matchesQuery = [
        invoice.invoiceNo,
        invoice.name,
        invoice.customer,
        invoice.clientEmail,
        status,
      ].some((value) => value?.toLowerCase().includes(query));
      return (
        matchesQuery && (statusFilter === "ALL" || status === statusFilter)
      );
    });
  }, [invoices, search, statusFilter]);

  const totalOutstanding = invoices.reduce(
    (sum, invoice) =>
      sum +
      invoiceOutstanding(invoice.totalAmount ?? 0, invoice.payments ?? []),
    0,
  );

  async function handleSend(invoice: Invoice) {
    const recipient = invoice.clientEmail || parseClientEmail(invoice.notes);
    if (!recipient) {
      setError(`Add a billing email to ${invoice.invoiceNo} before sending.`);
      return;
    }
    setActionLoading(invoice.id);
    setError(null);
    setMessage(null);
    try {
      await sendInvoice(invoice.id, { to: recipient });
      await refreshInvoices();
      setMessage(`Invoice sent to ${recipient}.`);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "Unable to send invoice.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRecordPayment(invoice: Invoice) {
    const balance = invoiceOutstanding(
      invoice.totalAmount ?? 0,
      invoice.payments ?? [],
    );
    if (balance <= 0) return;
    setActionLoading(invoice.id);
    setError(null);
    setMessage(null);
    try {
      await createPayment({
        invoiceId: invoice.id,
        amount: balance,
        paymentMethod: invoice.paymentMethod ?? "Bank Transfer",
        paymentDate: new Date().toISOString().slice(0, 10),
        status: "COMPLETED",
      });
      await updateInvoice(invoice.id, { status: "PAID" });
      await refreshInvoices();
      setMessage(`Payment recorded for ${invoice.invoiceNo}.`);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "Unable to record payment.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  function handleReminder(invoice: Invoice) {
    const recipient = invoice.clientEmail || parseClientEmail(invoice.notes);
    if (!recipient) {
      setError(
        `Add a billing email to ${invoice.invoiceNo} before sending a reminder.`,
      );
      return;
    }
    const subject = encodeURIComponent(
      `Payment reminder for ${invoice.invoiceNo}`,
    );
    const body = encodeURIComponent(
      `Hello ${invoice.customer ?? "Client"},\n\nThis is a reminder that invoice ${invoice.invoiceNo} is due.\n\nRegards,`,
    );
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  }

  async function handleDelete(invoice: Invoice) {
    if (!confirm(`Delete invoice ${invoice.invoiceNo}?`)) return;
    setActionLoading(invoice.id);
    setError(null);
    try {
      await deleteInvoice(invoice.id);
      setInvoices((current) =>
        current.filter((entry) => entry.id !== invoice.id),
      );
      setMessage(`${invoice.invoiceNo} deleted.`);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "Unable to delete invoice.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  if (role === "UNAUTHENTICATED") {
    return (
      <div className="p-6 text-sm text-slate-600">
        Invoices are available to authorized finance users.
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-360 space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">
            Accounts receivable
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            Invoices
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
            <span>
              {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>{formatInr(totalOutstanding)} outstanding</span>
          </p>
        </div>
        {canManage ? (
          <Link
            href="/dashboard/invoices/add"
            className="inline-flex h-10 items-center gap-2 self-start rounded-md bg-orange-600 px-3.5 text-sm font-medium text-white transition hover:bg-orange-700 sm:self-auto"
          >
            <FilePlus2 size={16} aria-hidden="true" />
            New invoice
          </Link>
        ) : null}
      </header>

      <section
        aria-label="Invoice filters"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <label className="relative block w-full sm:max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <span className="sr-only">Search invoices</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search invoice, customer, or email"
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </label>
        <div className="flex items-center gap-3">
          <label htmlFor="invoice-status" className="sr-only">
            Filter invoices by status
          </label>
          <select
            id="invoice-status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as InvoiceStatusFilter)
            }
            className="h-10 min-w-44 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-orange-400"
          >
            {FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {filter === "ALL"
                  ? "All statuses"
                  : filter.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <span className="whitespace-nowrap text-sm text-slate-500">
            {filteredInvoices.length} results
          </span>
        </div>
      </section>

      {message ? (
        <p role="status" className="text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section aria-label="Invoices" className="border-t border-slate-200">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">
            Loading invoices…
          </div>
        ) : error && invoices.length === 0 ? null : filteredInvoices.length ===
          0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-sm font-medium text-slate-800">
              {invoices.length
                ? "No invoices match these filters"
                : "No invoices yet"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {invoices.length
                ? "Try a different search or status."
                : "Create an invoice to start tracking receivables."}
            </p>
            {!invoices.length && canManage ? (
              <Link
                href="/dashboard/invoices/add"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-orange-700"
              >
                <FilePlus2 size={16} />
                Create invoice
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-190 text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-3 pr-4">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Balance due</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Due date</th>
                    <th className="w-12 py-3 pl-4">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((invoice) => {
                    const status = invoiceStatus(invoice);
                    const outstanding = invoiceOutstanding(
                      invoice.totalAmount ?? 0,
                      invoice.payments ?? [],
                    );
                    const isLoading = actionLoading === invoice.id;
                    return (
                      <tr
                        key={invoice.id}
                        className="group transition-colors hover:bg-slate-50/70"
                      >
                        <td className="py-4 pr-4">
                          <Link
                            href={`/dashboard/invoices/${invoice.id}`}
                            className="font-medium text-slate-900 hover:text-orange-700 hover:underline"
                          >
                            {invoice.name || invoice.invoiceNo}
                          </Link>
                          <div className="mt-1 text-xs text-slate-500">
                            {invoice.invoiceNo} · Issued{" "}
                            {formatDate(invoice.issueDate)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-800">
                            {invoice.customer ?? "Unassigned customer"}
                          </div>
                          {invoice.clientEmail ? (
                            <div className="mt-1 text-xs text-slate-500">
                              {invoice.clientEmail}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-900">
                          {formatInr(invoice.totalAmount ?? 0)}
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums text-slate-700">
                          {formatInr(outstanding)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={status} />
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <div>{formatDate(invoice.dueDate)}</div>
                          {status === "OVERDUE" ? (
                            <div className="mt-1 text-xs text-rose-600">
                              Payment overdue
                            </div>
                          ) : null}
                        </td>
                        <td className="py-2 pl-4 text-right">
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                type="button"
                                disabled={isLoading}
                                aria-label={`Actions for ${invoice.invoiceNo}`}
                                title="Invoice actions"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
                              >
                                <MoreHorizontal size={18} />
                              </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                align="end"
                                sideOffset={6}
                                className="z-50 min-w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                              >
                                <DropdownMenu.Item
                                  asChild
                                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50"
                                >
                                  <Link
                                    href={`/dashboard/invoices/${invoice.id}`}
                                  >
                                    <Eye size={15} />
                                    Open invoice
                                  </Link>
                                </DropdownMenu.Item>
                                {canManage ? (
                                  <DropdownMenu.Item
                                    asChild
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50"
                                  >
                                    <Link
                                      href={`/dashboard/invoices/${invoice.id}/edit`}
                                    >
                                      <Pencil size={15} />
                                      Edit invoice
                                    </Link>
                                  </DropdownMenu.Item>
                                ) : null}
                                {canManage && status === "DRAFT" ? (
                                  <DropdownMenu.Item
                                    disabled={isLoading}
                                    onSelect={() => void handleSend(invoice)}
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50 data-disabled:opacity-40"
                                  >
                                    <Send size={15} />
                                    Send invoice
                                  </DropdownMenu.Item>
                                ) : null}
                                {canManage &&
                                outstanding > 0 &&
                                status !== "DRAFT" ? (
                                  <DropdownMenu.Item
                                    disabled={isLoading}
                                    onSelect={() =>
                                      void handleRecordPayment(invoice)
                                    }
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50 data-disabled:opacity-40"
                                  >
                                    <Check size={15} />
                                    Record full balance payment
                                  </DropdownMenu.Item>
                                ) : null}
                                {canManage && status === "OVERDUE" ? (
                                  <DropdownMenu.Item
                                    onSelect={() => handleReminder(invoice)}
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50"
                                  >
                                    <Bell size={15} />
                                    Send reminder
                                  </DropdownMenu.Item>
                                ) : null}
                                {canManage ? (
                                  <>
                                    <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
                                    <DropdownMenu.Item
                                      disabled={isLoading}
                                      onSelect={() =>
                                        void handleDelete(invoice)
                                      }
                                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-rose-700 outline-none hover:bg-rose-50 data-disabled:opacity-40"
                                    >
                                      <Trash2 size={15} />
                                      Delete invoice
                                    </DropdownMenu.Item>
                                  </>
                                ) : null}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-200 md:hidden">
              {filteredInvoices.map((invoice) => {
                const status = invoiceStatus(invoice);
                const outstanding = invoiceOutstanding(
                  invoice.totalAmount ?? 0,
                  invoice.payments ?? [],
                );
                const isLoading = actionLoading === invoice.id;
                return (
                  <li
                    key={invoice.id}
                    className="flex items-start justify-between gap-3 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="block truncate text-sm font-medium text-slate-900"
                      >
                        {invoice.name || invoice.invoiceNo}
                      </Link>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {invoice.customer ?? "Unassigned customer"} ·{" "}
                        {invoice.invoiceNo}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <StatusBadge status={status} />
                        <span className="text-xs text-slate-500">
                          Due {formatDate(invoice.dueDate)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start gap-1">
                      <div className="pt-2 text-right">
                        <div className="text-sm font-semibold tabular-nums text-slate-900">
                          {formatInr(invoice.totalAmount ?? 0)}
                        </div>
                        <div className="mt-1 text-xs tabular-nums text-slate-500">
                          Due {formatInr(outstanding)}
                        </div>
                      </div>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            type="button"
                            disabled={isLoading}
                            aria-label={`Actions for ${invoice.invoiceNo}`}
                            title="Invoice actions"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            align="end"
                            sideOffset={6}
                            className="z-50 min-w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                          >
                            <DropdownMenu.Item
                              asChild
                              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50"
                            >
                              <Link href={`/dashboard/invoices/${invoice.id}`}>
                                <Eye size={15} />
                                Open invoice
                              </Link>
                            </DropdownMenu.Item>
                            {canManage ? (
                              <DropdownMenu.Item
                                asChild
                                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50"
                              >
                                <Link
                                  href={`/dashboard/invoices/${invoice.id}/edit`}
                                >
                                  <Pencil size={15} />
                                  Edit invoice
                                </Link>
                              </DropdownMenu.Item>
                            ) : null}
                            {canManage && status === "DRAFT" ? (
                              <DropdownMenu.Item
                                onSelect={() => void handleSend(invoice)}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50"
                              >
                                <Send size={15} />
                                Send invoice
                              </DropdownMenu.Item>
                            ) : null}
                            {canManage &&
                            outstanding > 0 &&
                            status !== "DRAFT" ? (
                              <DropdownMenu.Item
                                onSelect={() =>
                                  void handleRecordPayment(invoice)
                                }
                                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50"
                              >
                                <Check size={15} />
                                Record payment
                              </DropdownMenu.Item>
                            ) : null}
                            {canManage && status === "OVERDUE" ? (
                              <DropdownMenu.Item
                                onSelect={() => handleReminder(invoice)}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50"
                              >
                                <Bell size={15} />
                                Send reminder
                              </DropdownMenu.Item>
                            ) : null}
                            {canManage ? (
                              <DropdownMenu.Item
                                onSelect={() => void handleDelete(invoice)}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-rose-700 outline-none hover:bg-rose-50"
                              >
                                <Trash2 size={15} />
                                Delete invoice
                              </DropdownMenu.Item>
                            ) : null}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
