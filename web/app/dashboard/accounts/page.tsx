'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getExpenses, type Expense } from '@/api/expensesApi';
import { getInvoices, type Invoice } from '@/api/invoicesApi';
import { formatDate, formatInr, invoiceOutstanding, normalizeInvoiceStatus } from '@/utils/finance';

type DashboardRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

type SessionState = DashboardRole | 'UNAUTHENTICATED' | null;

type KpiCardProps = {
  label: string;
  value: string;
  icon: ReactNode;
  accent: 'green' | 'amber' | 'red' | 'blue';
  change?: string | null;
  trend?: 'up' | 'down' | null;
};

const APPROVED_EXPENSE_STATUSES = new Set(['APPROVED']);

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthWindow(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  return { start, end };
}

function previousMonthWindow(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const end = new Date(reference.getFullYear(), reference.getMonth(), 1);
  return { start, end };
}

function inRange(value: string | null | undefined, start: Date, end: Date): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time < end.getTime();
}

function paymentAmount(payment: { amount: number; status?: string | null }) {
  const status = (payment.status ?? '').toUpperCase();
  if (status === 'FAILED') return 0;
  if (status === 'REFUNDED') return -toNumber(payment.amount);
  return toNumber(payment.amount);
}

function paidInvoiceAmount(invoice: Invoice) {
  const status = normalizeInvoiceStatus(invoice.status);
  if (status !== 'PAID') return 0;
  return toNumber(invoice.totalAmount);
}

function invoiceRevenueInRange(invoice: Invoice, start: Date, end: Date) {
  return (invoice.payments ?? []).reduce((sum, payment) => {
    if (!inRange(payment.paymentDate, start, end)) return sum;
    return sum + paymentAmount(payment);
  }, 0);
}

function expenseAmountInRange(expense: Expense, start: Date, end: Date) {
  if (!inRange(expense.expenseDate, start, end)) return 0;
  if (!APPROVED_EXPENSE_STATUSES.has((expense.status ?? '').toUpperCase())) return 0;
  return toNumber(expense.amount);
}

function changeLabel(current: number, previous: number) {
  if (!previous && !current) return null;
  if (!previous) return '+ 100% vs last month';
  const delta = ((current - previous) / previous) * 100;
  const prefix = delta >= 0 ? '+' : '-';
  return `${prefix}${Math.abs(delta).toFixed(0)}% vs last month`;
}

function accentClasses(accent: KpiCardProps['accent']) {
  switch (accent) {
    case 'green':
      return { icon: 'text-emerald-600', border: 'border-emerald-100', value: 'text-slate-900' };
    case 'amber':
      return { icon: 'text-amber-600', border: 'border-amber-100', value: 'text-slate-900' };
    case 'red':
      return { icon: 'text-rose-600', border: 'border-rose-100', value: 'text-slate-900' };
    case 'blue':
    default:
      return { icon: 'text-blue-600', border: 'border-blue-100', value: 'text-slate-900' };
  }
}

function KpiCard({ label, value, icon, accent, change, trend }: KpiCardProps) {
  const styles = accentClasses(accent);
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-5 ${styles.border}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 ${styles.icon}`}>{icon}</div>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        </div>
      </div>
      <p className={`mt-4 text-[28px] font-medium leading-none ${styles.value}`}>{value}</p>
      {change ? (
        <p className={`mt-2 text-xs font-medium ${trend === 'down' ? 'text-rose-600' : 'text-emerald-600'}`}>{change}</p>
      ) : null}
    </div>
  );
}

function TrendUpIcon() {
  return <span className="text-lg leading-none">↗</span>;
}

function ClockIcon() {
  return <span className="text-lg leading-none">◔</span>;
}

function ReceiptIcon() {
  return <span className="text-lg leading-none">⌗</span>;
}

function ChartIcon() {
  return <span className="text-lg leading-none">▤</span>;
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const classes: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    SENT: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200',
    PAID: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
    OVERDUE: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200',
  };

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes[normalized] ?? classes.SENT}`}>{normalized}</span>;
}

function getInvoiceUiStatus(invoice: Invoice) {
  const status = normalizeInvoiceStatus(invoice.status);
  const outstanding = invoiceOutstanding(toNumber(invoice.totalAmount), invoice.payments ?? []);
  const dueTime = invoice.dueDate ? new Date(invoice.dueDate).getTime() : null;
  const overdue = Boolean(dueTime && dueTime < Date.now() && outstanding > 0 && ['ISSUED', 'PARTIALLY_PAID'].includes(status));

  if (overdue) return 'OVERDUE';
  if (status === 'PAID') return 'PAID';
  if (status === 'DRAFT') return 'DRAFT';
  return 'SENT';
}

function invoiceNumber(invoice: Invoice) {
  const suffix = String(invoice.id).padStart(3, '0');
  return `INV-${suffix}`;
}

function toMonthLabel(value: string | null | undefined) {
  if (!value) return 'N/A';
  return formatDate(value);
}

function sumExpenseCategories(expenses: Expense[]) {
  const grouped = new Map<string, number>();
  for (const expense of expenses) {
    const category = expense.category?.trim() || 'Uncategorized';
    grouped.set(category, (grouped.get(category) ?? 0) + toNumber(expense.amount));
  }
  return [...grouped.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);
}

function formatCurrency(value: number) {
  return formatInr(value, 0);
}

function getStatusFromRole(role: DashboardRole | null) {
  if (role === 'ADMIN' || role === 'HR') return 'allowed';
  return 'blocked';
}

export default function AccountsPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
    if (storedRole === 'ADMIN' || storedRole === 'HR') {
      setSession(storedRole);
    } else if (storedRole === 'MANAGER' || storedRole === 'EMPLOYEE') {
      setSession('UNAUTHENTICATED');
    } else {
      setSession('UNAUTHENTICATED');
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const [invoiceRows, expenseRows] = await Promise.all([getInvoices(), getExpenses()]);
        if (!active) return;
        setInvoices(invoiceRows);
        setExpenses(expenseRows);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load accounts data');
      } finally {
        if (active) setLoading(false);
      }
    }

    if (session === 'ADMIN' || session === 'HR') {
      void load();
    } else if (session === 'UNAUTHENTICATED') {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [session]);

  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = monthWindow(now);
    const previousMonth = previousMonthWindow(now);

    const totalRevenue = invoices.reduce((sum, invoice) => sum + paidInvoiceAmount(invoice), 0);
    const outstanding = invoices.reduce((sum, invoice) => sum + invoiceOutstanding(toNumber(invoice.totalAmount), invoice.payments ?? []), 0);
    const currentMonthRevenue = invoices.reduce((sum, invoice) => sum + invoiceRevenueInRange(invoice, currentMonth.start, currentMonth.end), 0);
    const previousMonthRevenue = invoices.reduce((sum, invoice) => sum + invoiceRevenueInRange(invoice, previousMonth.start, previousMonth.end), 0);
    const currentMonthExpenses = expenses.reduce((sum, expense) => sum + expenseAmountInRange(expense, currentMonth.start, currentMonth.end), 0);
    const previousMonthExpenses = expenses.reduce((sum, expense) => sum + expenseAmountInRange(expense, previousMonth.start, previousMonth.end), 0);

    return {
      totalRevenue,
      outstanding,
      currentMonthExpenses,
      netThisMonth: currentMonthRevenue - currentMonthExpenses,
      totalRevenueChange: changeLabel(currentMonthRevenue, previousMonthRevenue),
      expensesChange: changeLabel(currentMonthExpenses, previousMonthExpenses),
      netChange: changeLabel(currentMonthRevenue - currentMonthExpenses, previousMonthRevenue - previousMonthExpenses),
      netTrend: currentMonthRevenue - currentMonthExpenses >= 0 ? ('up' as const) : ('down' as const),
      netAccent: currentMonthRevenue - currentMonthExpenses >= 0 ? ('green' as const) : ('red' as const),
    };
  }, [expenses, invoices]);

  const recentInvoices = useMemo(() => invoices.slice().sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 8), [invoices]);
  const expenseBreakdown = useMemo(() => sumExpenseCategories(expenses), [expenses]);
  const maxCategoryTotal = expenseBreakdown[0]?.amount ?? 0;

  if (session === 'UNAUTHENTICATED') {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <p className="font-medium">Accounts is available to Admin and HR users only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-600">Accounts overview</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Finance dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">A single view of revenue, outstanding receivables, expenses, and payroll activity across the ERP.</p>
          </div>
          <div className="text-xs font-medium text-slate-400">{getStatusFromRole(session)}</div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          <KpiCard
            label="Total revenue"
            value={formatCurrency(metrics.totalRevenue)}
            icon={<TrendUpIcon />}
            accent="green"
            change={metrics.totalRevenueChange}
            trend={metrics.totalRevenueChange?.startsWith('-') ? 'down' : 'up'}
          />
          <KpiCard
            label="Outstanding"
            value={formatCurrency(metrics.outstanding)}
            icon={<ClockIcon />}
            accent="amber"
          />
          <KpiCard
            label="Total expenses"
            value={formatCurrency(metrics.currentMonthExpenses)}
            icon={<ReceiptIcon />}
            accent="red"
            change={metrics.expensesChange}
            trend={metrics.expensesChange?.startsWith('-') ? 'down' : 'up'}
          />
          <KpiCard
            label="Net this month"
            value={formatCurrency(metrics.netThisMonth)}
            icon={<ChartIcon />}
            accent={metrics.netAccent}
            change={metrics.netChange}
            trend={metrics.netTrend}
          />
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading accounts data…</div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Recent invoices</h2>
                <p className="text-sm text-slate-500">Latest eight invoices from the system.</p>
              </div>
              <Link href="/dashboard/invoices" className="text-sm font-medium text-blue-600 hover:underline">View all invoices</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Due date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentInvoices.map((invoice) => {
                    const uiStatus = getInvoiceUiStatus(invoice);
                    const outstanding = invoiceOutstanding(toNumber(invoice.totalAmount), invoice.payments ?? []);
                    const overdue = uiStatus === 'OVERDUE';
                    return (
                      <tr
                        key={invoice.id}
                        onClick={() => router.push('/dashboard/invoices')}
                        className="cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium text-slate-900">{invoice.customer ?? 'Unassigned client'}</p>
                          <p className="text-xs text-slate-500">{invoiceNumber(invoice)}</p>
                        </td>
                        <td className="px-5 py-4 text-right font-medium text-slate-900">{formatCurrency(toNumber(invoice.totalAmount))}</td>
                        <td className="px-5 py-4"><StatusPill status={uiStatus} /></td>
                        <td className={`px-5 py-4 ${overdue ? 'font-medium text-rose-600' : 'text-slate-600'}`}>
                          {toMonthLabel(invoice.dueDate)}
                          <div className="text-xs text-slate-400">{outstanding > 0 ? `Outstanding ${formatCurrency(outstanding)}` : 'Settled'}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Expense breakdown</h2>
                <p className="text-sm text-slate-500">Grouped totals by category.</p>
              </div>
              <Link href="/dashboard/expenses" className="text-sm font-medium text-blue-600 hover:underline">View all expenses</Link>
            </div>
            <div className="space-y-4 px-5 py-5">
              {expenseBreakdown.length === 0 ? (
                <p className="text-sm text-slate-500">No expenses recorded yet.</p>
              ) : (
                expenseBreakdown.map((item) => {
                  const width = maxCategoryTotal > 0 ? Math.max(4, (item.amount / maxCategoryTotal) * 100) : 0;
                  return (
                    <div key={item.category} className="space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-medium text-slate-800">{item.category}</p>
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-amber-400" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Quick actions</h2>
          <p className="text-sm text-slate-500">Fast entry points for the most common finance tasks.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/invoices/new')}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">＋</span>
            <span>New invoice</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/expenses/new')}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600">＋</span>
            <span>Record expense</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/payroll')}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">₹</span>
            <span>Run payroll</span>
          </button>
        </div>
      </section>
    </div>
  );
}
