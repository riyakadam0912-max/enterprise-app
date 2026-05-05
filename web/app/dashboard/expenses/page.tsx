'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteExpense,
  getExpenses,
  hrApproveExpense,
  managerApproveExpense,
  rejectExpense,
  type Expense,
} from '@/api/expensesApi';
import TableActions from '@/components/common/TableActions';
import { formatInrCurrency } from '@/utils/formatCurrency';

const CATEGORY_COLOR: Record<string, string> = {
  'Office Supplies': 'text-orange-500',
  'Marketing':       'text-teal-600',
  'Utilities':       'text-purple-600',
  'Training':        'text-blue-600',
  'Travel':          'text-orange-500',
  'Other':           'text-gray-500',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:  'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
};

function fmtDate(val: string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AllExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const role = typeof window !== 'undefined' ? (localStorage.getItem('role') ?? 'EMPLOYEE') : 'EMPLOYEE';
  const canManagerApprove = role === 'MANAGER' || role === 'ADMIN';
  const canHrApprove = role === 'HR' || role === 'ADMIN';

  useEffect(() => {
    getExpenses()
      .then(setExpenses)
      .catch(() => setError('Failed to load expenses'))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    if (!confirm('Delete this expense?')) return;
    await deleteExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  async function refreshExpenses() {
    setExpenses(await getExpenses());
  }

  async function handleManagerApprove(id: number) {
    setActionLoadingId(id);
    try {
      await managerApproveExpense(id);
      await refreshExpenses();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleHrApprove(id: number) {
    setActionLoadingId(id);
    try {
      await hrApproveExpense(id);
      await refreshExpenses();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReject(id: number) {
    const reason = prompt('Rejection reason (optional):') ?? undefined;
    setActionLoadingId(id);
    try {
      await rejectExpense(id, reason);
      await refreshExpenses();
    } finally {
      setActionLoadingId(null);
    }
  }

  function getLatestTrailText(expense: Expense) {
    const latest = expense.approvalTrail?.[expense.approvalTrail.length - 1];
    if (!latest) return null;

    const actionLabel = latest.action.replaceAll('_', ' ').toLowerCase();
    return latest.reason ? `${actionLabel}: ${latest.reason}` : actionLabel;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">All Expenses</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard/expenses/add')}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Add Expense
          </button>
          <TableActions moduleKey="expenses" rows={expenses} onRefresh={() => getExpenses().then(setExpenses)} />
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error   && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Expense ID','Expense Date','Category','Description','Amount','Currency','Receipt Image','Approved By','Status',''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-400">No records found</td>
                  </tr>
                ) : expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-medium">{e.id}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(e.expenseDate)}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <span className={CATEGORY_COLOR[e.category ?? ''] ?? 'text-gray-700'}>
                        {e.category ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-56 truncate">{e.description ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap text-right">
                      {e.amount != null ? formatInrCurrency(e.amount, 2) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.currency ?? '—'}</td>
                    <td className="px-4 py-3 text-blue-500 max-w-40 truncate">
                      {e.receiptImage ? (
                        <a href={e.receiptImage} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.receiptImage}</a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{e.approvedBy ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[e.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {e.status}
                        </span>
                        {getLatestTrailText(e) && <p className="text-[11px] text-gray-400">{getLatestTrailText(e)}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {canManagerApprove && e.status === 'PENDING_MANAGER' && (
                          <button
                            onClick={() => handleManagerApprove(e.id)}
                            disabled={actionLoadingId === e.id}
                            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50"
                          >
                            Manager approve
                          </button>
                        )}
                        {canHrApprove && e.status === 'PENDING_HR' && (
                          <button
                            onClick={() => handleHrApprove(e.id)}
                            disabled={actionLoadingId === e.id}
                            className="text-xs text-sky-600 hover:text-sky-800 font-medium disabled:opacity-50"
                          >
                            HR approve
                          </button>
                        )}
                        {(canManagerApprove || canHrApprove) && e.status !== 'APPROVED' && e.status !== 'REJECTED' && (
                          <button
                            onClick={() => handleReject(e.id)}
                            disabled={actionLoadingId === e.id}
                            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/dashboard/expenses/${e.id}/edit`)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            Showing {expenses.length} of {expenses.length}
          </div>
        </div>
      )}
    </div>
  );
}
