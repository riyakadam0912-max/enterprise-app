export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED' | 'EXPIRED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED' | 'VOIDED';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'RECONCILED' | 'PARTIALLY_SETTLED';

export interface QuoteLineItem {
  id?: number;
  name: string;
  quantity: number;
  price: number;
}

export interface InvoiceLineItem {
  id?: number;
  name: string;
  quantity: number;
  price: number;
}

export function formatInr(value: number | null | undefined, fractionDigits = 2): string {
  const safeValue = Number.isFinite(value ?? Number.NaN) ? Number(value) : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(safeValue);
}

export function formatDate(value: string | null | undefined, locale: Intl.LocalesArgument = 'en-GB'): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysBetween(from: string | null | undefined, to: Date = new Date()): number | null {
  if (!from) return null;
  const start = new Date(from).getTime();
  const end = to.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
}

export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
}

export function quoteLineTotal(item: QuoteLineItem | InvoiceLineItem): number {
  return (item.quantity ?? 0) * (item.price ?? 0);
}

export function sumLineItems(items: Array<QuoteLineItem | InvoiceLineItem>): number {
  return items.reduce((total, item) => total + quoteLineTotal(item), 0);
}

export function invoiceOutstanding(totalAmount: number, payments: Array<{ amount: number; status?: string }>): number {
  const paid = payments.reduce((total, payment) => {
    if ((payment.status ?? '').toUpperCase() === 'FAILED') return total;
    if ((payment.status ?? '').toUpperCase() === 'REFUNDED') return total - payment.amount;
    return total + payment.amount;
  }, 0);

  return Math.max(0, totalAmount - paid);
}

export function deriveQuoteStatus(status: string, validTill: string | null | undefined): QuoteStatus | string {
  const normalized = status.toUpperCase();
  if (normalized === 'CONVERTED' || normalized === 'EXPIRED') return normalized as QuoteStatus;
  if (normalized === 'SENT' && validTill) {
    const expiry = new Date(validTill).getTime();
    if (!Number.isNaN(expiry) && expiry < Date.now()) return 'EXPIRED';
  }
  return normalized;
}

export function normalizeInvoiceStatus(status: string | null | undefined): InvoiceStatus | string {
  return (status ?? 'DRAFT').toUpperCase();
}

export const QUOTE_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  SENT: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200',
  ACCEPTED: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  REJECTED: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200',
  CONVERTED: 'bg-violet-100 text-violet-700 ring-1 ring-violet-200',
  EXPIRED: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
};

export const INVOICE_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  ISSUED: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  PAID: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  OVERDUE: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200',
  CANCELLED: 'bg-slate-200 text-slate-600 ring-1 ring-slate-300',
  REFUNDED: 'bg-violet-100 text-violet-700 ring-1 ring-violet-200',
  VOIDED: 'bg-stone-100 text-stone-600 ring-1 ring-stone-200',
};

export const PAYMENT_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  FAILED: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200',
  REFUNDED: 'bg-violet-100 text-violet-700 ring-1 ring-violet-200',
  RECONCILED: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200',
  PARTIALLY_SETTLED: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
};
