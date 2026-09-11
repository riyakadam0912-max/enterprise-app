'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { getExpenses, getExpenseReceipt, createExpense, updateExpense, deleteExpense, managerApproveExpense, hrApproveExpense, rejectExpense, type Expense } from '@/api/expensesApi';
import { uploadFile } from '@/api/filesApi';
import { ImageCropDialog } from '@/components/common/ImageCropDialog';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useAuthSession } from '@/stores/auth-store';
import { formatDate, formatInr } from '@/utils/finance';

type DashboardRole = 'SUPER_ADMIN' | 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';
type SessionState = DashboardRole | 'UNAUTHENTICATED' | null;
type ExpenseUiStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ExpenseFormState = {
  category: (typeof CATEGORY_OPTIONS)[number];
  amount: string;
  date: string;
  description: string;
  receiptFile: File | null;
};

const CATEGORY_OPTIONS = ['Travel', 'Food', 'Equipment', 'Software', 'Training', 'Other'] as const;

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function normalizedExpenseStatus(value?: string | null): ExpenseUiStatus | string {
  const status = (value ?? 'PENDING').toUpperCase();
  if (status.startsWith('PENDING')) return 'PENDING';
  if (status === 'APPROVED') return 'APPROVED';
  if (status === 'REJECTED') return 'REJECTED';
  return status;
}

function expenseStatusClass(status: ExpenseUiStatus) {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
    case 'REJECTED':
      return 'bg-rose-100 text-rose-700 ring-1 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  }
}

function toNumber(value: number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function approveIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
}

function rejectIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>;
}

function eyeIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 12s3.5-7 10.5-7 10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
}

function closeIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>;
}

function DrawerShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed inset-0 z-50 flex justify-end p-4 sm:p-6">
        <div className="flex h-full w-full max-w-95 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
          {children}
        </div>
      </aside>
    </>
  );
}

function StatusBadge({ status }: { status: ExpenseUiStatus | string }) {
  const normalized = (['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? status : 'PENDING') as ExpenseUiStatus;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${expenseStatusClass(normalized)}`}>{normalized}</span>;
}

function EmployeeAvatar({ userId, name }: { userId?: number | null; name?: string | null }) {
  return <UserAvatar userId={userId} name={name} size="md" className="bg-slate-900" />;
}

export default function ExpensesPage() {
  const auth = useAuthSession();
  const sessionRole: SessionState = auth.user || auth.employeeId != null ? auth.role : 'UNAUTHENTICATED';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExpenseUiStatus>('ALL');
  const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptPreviewLoading, setReceiptPreviewLoading] = useState(false);
  const [showSubmitDrawer, setShowSubmitDrawer] = useState(false);
  const [rejectingExpenseId, setRejectingExpenseId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormState>({
    category: CATEGORY_OPTIONS[0],
    amount: '',
    date: todayInputValue(),
    description: '',
    receiptFile: null,
  });
  const [cropFile, setCropFile] = useState<File | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const rows = await getExpenses();
        if (!active) return;
        setExpenses(rows);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load expenses');
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

  const canSubmitExpense = sessionRole === 'EMPLOYEE' || sessionRole === 'MANAGER';
  const selectedExpense = useMemo(() => expenses.find((expense) => expense.id === selectedExpenseId) ?? null, [expenses, selectedExpenseId]);
  const selectedStatus = selectedExpense ? normalizedExpenseStatus(selectedExpense.status) : null;

  useEffect(() => {
    if (!selectedExpense?.receiptImage) {
      setReceiptPreviewUrl(null);
      setReceiptPreviewLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setReceiptPreviewLoading(true);

    void getExpenseReceipt(selectedExpense.id)
      .then((blob) => {
        const nextObjectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }
        objectUrl = nextObjectUrl;
        setReceiptPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setReceiptPreviewUrl(null);
      })
      .finally(() => {
        if (!cancelled) setReceiptPreviewLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedExpense]);
  
  function canActOnSelectedExpense() {
    if (!selectedExpense) return false;
    return canActOnExpense(selectedExpense);
  }

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const expense of expenses) {
      if (expense.category?.trim()) unique.add(expense.category.trim());
    }
    return ['ALL', ...Array.from(unique).sort((left, right) => left.localeCompare(right))];
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      const uiStatus = normalizedExpenseStatus(expense.status);
      const matchesSearch = (expense.description ?? '').toLowerCase().includes(query) || (expense.category ?? '').toLowerCase().includes(query);
      const matchesCategory = categoryFilter === 'ALL' || (expense.category ?? '') === categoryFilter;
      const matchesStatus = statusFilter === 'ALL' || uiStatus === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, expenses, search, statusFilter]);

  async function handleSubmitExpense() {
    try {
      setActionLoadingId(-1);
      setMessage(null);
      setError(null);

      const created = await createExpense({
        expenseDate: form.date,
        category: form.category,
        description: form.description.trim(),
        amount: Number(form.amount),
        currency: 'INR',
      });

      let finalExpense = created;
      if (form.receiptFile) {
        const formData = new FormData();
        formData.append('file', form.receiptFile);
        formData.append('module', 'expenses');
        formData.append('entityType', 'Expense');
        formData.append('entityId', String(created.id));
        formData.append('category', 'receipt');
        formData.append('isPublic', 'false');
        await uploadFile(formData);
        finalExpense = await updateExpense(created.id, {
          receiptImage: `/api/v1/expenses/${created.id}/receipt`,
        });
      }

      setExpenses((prev) => [finalExpense, ...prev]);
      setForm({
        category: CATEGORY_OPTIONS[0],
        amount: '',
        date: todayInputValue(),
        description: '',
        receiptFile: null,
      });
      setShowSubmitDrawer(false);
      setMessage('Expense submitted successfully');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit expense');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleApprove(expense: Expense) {
    try {
      setActionLoadingId(expense.id);
      setMessage(null);
      setError(null);

      const status = (expense.status ?? '').toUpperCase();
      if (status === 'PENDING_HR') {
        const updated = await hrApproveExpense(expense.id);
        setExpenses((prev) => prev.map((row) => (row.id === expense.id ? updated : row)));
      } else if (status === 'PENDING_MANAGER') {
        const updated = await managerApproveExpense(expense.id);
        setExpenses((prev) => prev.map((row) => (row.id === expense.id ? updated : row)));
      }
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Failed to approve expense');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReject(expense: Expense) {
    try {
      setActionLoadingId(expense.id);
      setMessage(null);
      setError(null);
      const updated = await rejectExpense(expense.id, rejectReason.trim() || undefined);
      setExpenses((prev) => prev.map((row) => (row.id === expense.id ? updated : row)));
      setRejectingExpenseId(null);
      setRejectReason('');
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Failed to reject expense');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDelete(expense: Expense) {
    if (!window.confirm(`Delete expense #${expense.id}? This action cannot be undone.`)) return;

    try {
      setActionLoadingId(expense.id);
      setMessage(null);
      setError(null);
      await deleteExpense(expense.id);
      setExpenses((prev) => prev.filter((row) => row.id !== expense.id));
      setSelectedExpenseId(null);
      setMessage(`Expense #${expense.id} deleted successfully.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete expense');
    } finally {
      setActionLoadingId(null);
    }
  }

  function startRejecting(expenseId: number) {
    setRejectingExpenseId(expenseId);
    setRejectReason('');
  }

  function canActOnExpense(expense: Expense) {
    const status = (expense.status ?? '').toUpperCase();
    if (status === 'PENDING_MANAGER') return sessionRole === 'ADMIN' || sessionRole === 'MANAGER';
    if (status === 'PENDING_HR') return sessionRole === 'ADMIN';
    return false;
  }

  function canDeleteExpense() {
    return sessionRole === 'ADMIN' || sessionRole === 'HR';
  }

  function employeeName(expense: Expense) {
    return expense.employee?.name ?? expense.submittedByUser?.name ?? 'Unassigned';
  }

  function employeeUserId(expense: Expense) {
    return expense.submittedByUser?.id ?? null;
  }

  if (sessionRole === 'UNAUTHENTICATED') {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Expenses is available to authenticated users only.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">Expense tracker</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Expenses</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Submit, review, and approve company spend with a workflow that stays visible to every role.</p>
          </div>
          {canSubmitExpense ? (
            <button
              type="button"
              onClick={() => setShowSubmitDrawer(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              <span className="text-base leading-none"><PlusIcon /></span>
              Submit expense
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search description or category"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-orange-400"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400"
          >
            {categories.map((category) => (
              <option key={category} value={category}>{category === 'ALL' ? 'All categories' : category}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'ALL' | ExpenseUiStatus)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-orange-400"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </section>

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading expenses…</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-400">No expenses match the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((expense) => {
                  const uiStatus = normalizedExpenseStatus(expense.status) as ExpenseUiStatus;
                  const isRejecting = rejectingExpenseId === expense.id;
                  const canAct = canActOnExpense(expense);

                  return (
                    <tr
                      key={expense.id}
                      onClick={() => setSelectedExpenseId(expense.id)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar userId={employeeUserId(expense)} name={employeeName(expense)} />
                          <div>
                            <div className="font-medium text-slate-900">{employeeName(expense)}</div>
                            <div className="text-xs text-slate-500">Expense #{expense.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-900">{expense.category ?? 'Uncategorized'}</td>
                      <td className="px-5 py-4 text-slate-600">{expense.description ?? '—'}</td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-900">{formatInr(toNumber(expense.amount), 0)}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(expense.expenseDate)}</td>
                      <td className="px-5 py-4"><StatusBadge status={uiStatus} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="Open expense"
                            aria-label="Open expense"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedExpenseId(expense.id);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                          >
                            {eyeIcon()}
                          </button>
                          {canAct && !isRejecting ? (
                            <>
                              <button
                                type="button"
                                title="Approve"
                                aria-label="Approve expense"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleApprove(expense);
                                }}
                                disabled={actionLoadingId === expense.id}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                              >
                                {approveIcon()}
                              </button>
                              <button
                                type="button"
                                title="Reject"
                                aria-label="Reject expense"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startRejecting(expense.id);
                                }}
                                disabled={actionLoadingId === expense.id}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                              >
                                {rejectIcon()}
                              </button>
                            </>
                          ) : null}
                        </div>
                        {isRejecting ? (
                          <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3" onClick={(event) => event.stopPropagation()}>
                            <textarea
                              value={rejectReason}
                              onChange={(event) => setRejectReason(event.target.value)}
                              rows={2}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                              placeholder="Reason for rejection"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void handleReject(expense)}
                                disabled={actionLoadingId === expense.id}
                                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingExpenseId(null);
                                  setRejectReason('');
                                }}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedExpense ? (
        <DrawerShell onClose={() => setSelectedExpenseId(null)}>
          <div className="flex items-start justify-between border-b border-slate-200 bg-linear-to-r from-white to-slate-50 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expense detail</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Expense #{selectedExpense.id}</h2>
            </div>
            <button type="button" onClick={() => setSelectedExpenseId(null)} className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50" aria-label="Close expense details">
              {closeIcon()}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="flex items-start gap-3">
              <EmployeeAvatar userId={employeeUserId(selectedExpense)} name={employeeName(selectedExpense)} />
              <div className="min-w-0">
                <p className="text-sm text-slate-500">Employee</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{employeeName(selectedExpense)}</p>
                <p className="text-sm text-slate-500">{selectedExpense.category ?? 'Uncategorized'}</p>
              </div>
              <div className="ml-auto"><StatusBadge status={selectedStatus ?? 'PENDING'} /></div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{formatInr(toNumber(selectedExpense.amount), 0)}</p>
              <p className="mt-2 text-sm text-slate-600">{formatDate(selectedExpense.expenseDate)}</p>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900">Description</h3>
              <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selectedExpense.description ?? 'No description provided.'}</div>
            </div>

            {selectedExpense.receiptImage ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900">Receipt image</h3>
                <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {receiptPreviewLoading ? <p className="p-4 text-sm text-slate-500">Loading receipt...</p> : null}
                  {receiptPreviewUrl ? <Image src={receiptPreviewUrl} alt={`Receipt for expense #${selectedExpense.id}`} width={800} height={600} unoptimized className="max-h-96 w-full object-contain" /> : null}
                </div>
              </div>
            ) : null}

            {selectedExpense.rejectionReason ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <p className="font-semibold">Rejection reason</p>
                <p className="mt-2">{selectedExpense.rejectionReason}</p>
              </div>
            ) : null}
          </div>
          <div className="border-t border-slate-200 px-5 py-4">
            {canDeleteExpense() ? (
              <button
                type="button"
                onClick={() => void handleDelete(selectedExpense)}
                disabled={actionLoadingId === selectedExpense.id}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoadingId === selectedExpense.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                Delete expense
              </button>
            ) : null}
            {canActOnSelectedExpense() ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => void handleApprove(selectedExpense)}
                  disabled={actionLoadingId === selectedExpense.id}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  Approve
                </button>
                {rejectingExpenseId === selectedExpense.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                      placeholder="Reason for rejection"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleReject(selectedExpense)}
                        disabled={actionLoadingId === selectedExpense.id}
                        className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                      >
                        Confirm reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingExpenseId(null);
                          setRejectReason('');
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startRejecting(selectedExpense.id)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Reject
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{selectedStatus === 'APPROVED' ? 'Approved ✓' : selectedStatus === 'REJECTED' ? 'Rejected' : 'Read-only'} </div>
            )}
          </div>
        </DrawerShell>
      ) : null}

      {showSubmitDrawer ? (
        <DrawerShell onClose={() => setShowSubmitDrawer(false)}>
          <div className="flex items-start justify-between border-b border-slate-200 bg-linear-to-r from-white to-slate-50 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Submit expense</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">New expense</h2>
            </div>
            <button type="button" onClick={() => setShowSubmitDrawer(false)} className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50" aria-label="Close expense drawer">
              {closeIcon()}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Category</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as ExpenseFormState['category'] }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                >
                  {CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Amount</span>
                <div className="flex items-center rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-orange-400">
                  <span className="text-sm text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    className="ml-2 w-full border-0 bg-transparent p-0 text-sm outline-none"
                    placeholder="2500"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={5}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                  placeholder="What was this expense for?"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Receipt image</span>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (!file) return;
                      if (!['image/jpeg', 'image/png'].includes(file.type)) {
                        setError('Please choose a JPG, JPEG, or PNG image.');
                        event.target.value = '';
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        setError('Receipt image must be 5 MB or smaller.');
                        event.target.value = '';
                        return;
                      }
                      setError(null);
                      setCropFile(file);
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 file:mr-2 file:rounded-lg file:border-0 file:bg-orange-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-orange-700"
                  />
                  {form.receiptFile && <div className="text-xs text-slate-600">Selected: {form.receiptFile.name}</div>}
                  <div className="text-xs text-slate-500">JPG, JPEG, or PNG only. Crop before uploading.</div>
                </div>
              </label>
            </div>
            {cropFile ? <ImageCropDialog key={`${cropFile.name}-${cropFile.lastModified}`} file={cropFile} onCancel={() => setCropFile(null)} onCropped={(file) => { setForm((current) => ({ ...current, receiptFile: file })); setCropFile(null); }} /> : null}
          </div>
          <div className="border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={() => void handleSubmitExpense()}
              disabled={actionLoadingId === -1 || !form.description.trim() || !form.amount}
              className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              Submit expense
            </button>
          </div>
        </DrawerShell>
      ) : null}
    </div>
  );
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
}
