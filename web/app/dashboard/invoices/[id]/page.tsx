"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Pencil } from "lucide-react";
import { useStableNow } from "@/hooks/useStableNow";
import {
  downloadInvoicePdf,
  getInvoice,
  type Invoice,
  type InvoiceItem,
} from "@/api/invoicesApi";
import {
  INVOICE_STATUS_STYLES,
  formatDate,
  formatInr,
  invoiceOutstanding,
  normalizeInvoiceStatus,
} from "@/utils/finance";

function StatusBadge({ status }: { status: string }) {
  const cls =
    INVOICE_STATUS_STYLES[status] ??
    "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}
    >
      {status}
    </span>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = Number(params.id);
  const currentTime = useStableNow();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    getInvoice(invoiceId)
      .then(setInvoice)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load invoice"),
      )
      .finally(() => setLoading(false));
  }, [invoiceId]);

  const summary = useMemo(() => {
    const payments = invoice?.payments ?? [];
    const paid = payments.reduce(
      (total, payment) =>
        total +
        (payment.status === "REFUNDED" ? -payment.amount : payment.amount),
      0,
    );
    const outstanding = invoice
      ? invoiceOutstanding(invoice.totalAmount ?? 0, payments)
      : 0;
    return { paid, outstanding, payments };
  }, [invoice]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading invoice…</div>;
  }

  if (error || !invoice) {
    return (
      <div className="p-6 text-sm text-rose-600">
        {error ?? "Invoice not found"}
      </div>
    );
  }

  const status = normalizeInvoiceStatus(invoice.status);
  const agingDays = invoice.dueDate
    ? Math.floor(
        (currentTime - new Date(invoice.dueDate).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;
  const legacyItemSubtotal = Math.max(
    0,
    invoice.subtotal ??
      invoice.totalAmount - invoice.taxAmount + invoice.discount,
  );
  const lineItems: Array<
    Pick<InvoiceItem, "id" | "name" | "quantity" | "price"> &
      Partial<Pick<InvoiceItem, "description" | "discountAmount" | "unit">>
  > = invoice.items?.length
    ? invoice.items
    : [
        {
          id: 0,
          name: invoice.name || "Invoice total",
          description: invoice.notes,
          quantity: 1,
          price: legacyItemSubtotal,
          discountAmount: 0,
          unit: "Unit",
        },
      ];

  async function handleDownloadPdf() {
    if (!invoice) return;
    setPdfError(null);
    try {
      const blob = await downloadInvoicePdf(invoice.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${invoice.invoiceNo}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError: unknown) {
      setPdfError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download invoice PDF.",
      );
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <section className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/invoices"
                aria-label="Back to invoices"
                className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                <ArrowLeft size={17} aria-hidden="true" />
              </Link>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
                  Receivables detail
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950">
                  {invoice.name || `Invoice ${invoice.invoiceNo}`}
                </h1>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Customer {invoice.customer ?? "Unassigned"} · Due{" "}
              {formatDate(invoice.dueDate)} · Issued{" "}
              {formatDate(invoice.issueDate)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/invoices/${invoice.id}/edit`}
              aria-label="Edit invoice"
              title="Edit invoice"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Pencil size={16} />
            </Link>
            <button
              type="button"
              onClick={handleDownloadPdf}
              aria-label="Download invoice PDF"
              title="Download invoice PDF"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {pdfError ? (
          <p role="alert" className="mt-4 text-sm text-rose-700">
            {pdfError}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 pt-4 text-sm">
          {[
            { label: "Status", value: <StatusBadge status={status} /> },
            { label: "Total", value: formatInr(invoice.totalAmount ?? 0) },
            { label: "Paid", value: formatInr(summary.paid) },
            { label: "Outstanding", value: formatInr(summary.outstanding) },
          ].map((card) => (
            <div key={card.label} className="flex items-center gap-2">
              <span className="text-slate-500">{card.label}</span>
              <div className="font-semibold text-slate-900">{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="border-b border-slate-200 pb-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Invoice summary
            </h2>
            <span className="text-xs text-slate-400">
              Aging: {agingDays === null ? "—" : `${agingDays} days`}
            </span>
          </div>
          <div className="mt-4 grid gap-4 border-y border-slate-100 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {invoice.customer ?? "Not assigned"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment method
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {invoice.paymentMethod ?? "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Issue date
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {formatDate(invoice.issueDate)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Due date
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {formatDate(invoice.dueDate)}
              </p>
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
              <tbody className="divide-y divide-slate-100">
                {lineItems.map((item) => {
                  const amount = Math.max(
                    0,
                    item.quantity * item.price - (item.discountAmount ?? 0),
                  );
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {item.name}
                        </div>
                        {item.description ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {item.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatInr(item.price)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatInr(amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-100">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-right text-sm font-semibold text-slate-600"
                  >
                    Subtotal
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                    {formatInr(invoice.subtotal ?? legacyItemSubtotal)}
                  </td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-right text-sm font-semibold text-slate-600"
                  >
                    Tax
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                    {formatInr(invoice.taxAmount ?? 0)}
                  </td>
                </tr>
                {invoice.discount ? (
                  <tr className="border-t border-slate-100">
                    <td
                      colSpan={3}
                      className="px-4 py-3 text-right text-sm font-semibold text-slate-600"
                    >
                      Discount
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      −{formatInr(invoice.discount)}
                    </td>
                  </tr>
                ) : null}
                {invoice.adjustmentAmount ? (
                  <tr className="border-t border-slate-100">
                    <td
                      colSpan={3}
                      className="px-4 py-3 text-right text-sm font-semibold text-slate-600"
                    >
                      Adjustment
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      {formatInr(invoice.adjustmentAmount)}
                    </td>
                  </tr>
                ) : null}
                {invoice.tdsEnabled ? (
                  <tr className="border-t border-slate-100">
                    <td
                      colSpan={3}
                      className="px-4 py-3 text-right text-sm font-semibold text-slate-600"
                    >
                      TDS
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      −{formatInr(invoice.tdsAmount ?? 0)}
                    </td>
                  </tr>
                ) : null}
                {invoice.tcsEnabled ? (
                  <tr className="border-t border-slate-100">
                    <td
                      colSpan={3}
                      className="px-4 py-3 text-right text-sm font-semibold text-slate-600"
                    >
                      TCS
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      {formatInr(invoice.tcsAmount ?? 0)}
                    </td>
                  </tr>
                ) : null}
                <tr className="border-t border-slate-100">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-right text-sm font-semibold text-slate-600"
                  >
                    Invoice total
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                    {formatInr(invoice.totalAmount)}
                  </td>
                </tr>
                <tr className="border-t border-slate-100 bg-slate-50">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-right text-sm font-semibold text-slate-600"
                  >
                    Balance due
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-slate-900">
                    {formatInr(summary.outstanding)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="border-b border-slate-200 pb-5">
            <h2 className="text-sm font-semibold text-slate-700">
              Payment history
            </h2>
            <div className="mt-4 space-y-3">
              {summary.payments.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No payments recorded yet.
                </p>
              ) : (
                summary.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="border-b border-slate-100 py-3 last:border-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatInr(payment.amount)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {payment.paymentMethod} ·{" "}
                          {formatDate(payment.paymentDate)}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {payment.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Transaction: {payment.transactionId ?? "—"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="border-b border-slate-200 pb-5">
            <h2 className="text-sm font-semibold text-slate-700">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">
              {invoice.notes ?? "No notes captured."}
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
