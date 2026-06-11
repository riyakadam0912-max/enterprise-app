'use client';

import { useEffect, useState } from 'react';
import { getExpensesByCategory, type Expense } from '@/api/expensesApi';
import { formatInrCurrency } from '@/utils/formatCurrency';
import { reportError } from '@/lib/error-handling';

const CATEGORY_BORDER: Record<string, string> = {
  'Training':        'border-l-blue-500',
  'Travel':          'border-l-orange-500',
  'Utilities':       'border-l-purple-500',
  'Office Supplies': 'border-l-teal-500',
  'Marketing':       'border-l-pink-500',
  'Other':           'border-l-gray-400',
};

const CURRENCY_COLOR = 'text-orange-500';

function fmtDate(val: string | null) {
  if (!val) return null;
  return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ExpenseCard({ expense }: { expense: Expense }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm hover:shadow-md transition-shadow">
      <p className="font-semibold text-gray-900 text-sm">{expense.description ?? '(no description)'}</p>
      {expense.currency && (
        <p className={`text-xs mt-0.5 font-medium ${CURRENCY_COLOR}`}>{expense.currency}</p>
      )}
      {expense.expenseDate && (
        <p className="text-xs text-gray-400 mt-1">{fmtDate(expense.expenseDate)}</p>
      )}
      {expense.amount != null && (
        <p className="text-xs text-gray-500 mt-0.5">
          {formatInrCurrency(expense.amount, 2)}
        </p>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const [grouped, setGrouped] = useState<Record<string, Expense[]>>({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    async function loadCategories() {
      try {
        setGrouped(await getExpensesByCategory());
      } catch (error) {
        reportError(error, 'Unable to load expense categories');
        setError('Failed to load categories');
      } finally {
        setLoading(false);
      }
    }

    loadCategories();
  }, []);

  const columns = Object.keys(grouped);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Categories</h1>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error   && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && !error && columns.length === 0 && (
        <p className="text-gray-400 text-sm">No expenses found. Add some expenses to see them grouped by category.</p>
      )}

      {!loading && !error && columns.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((category) => {
            const cards = grouped[category] ?? [];
            const borderClass = CATEGORY_BORDER[category] ?? 'border-l-gray-400';
            return (
              <div key={category} className="shrink-0 w-72">
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 bg-white border border-b-0 border-gray-200 rounded-t-lg border-l-4 ${borderClass}`}>
                  <span className="text-sm font-semibold text-gray-800">{category}</span>
                  <span className="text-xs text-gray-400">{cards.length}</span>
                </div>

                {/* Cards */}
                <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg p-2 min-h-32">
                  {cards.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 py-6">No records</p>
                  ) : (
                    cards.map((exp) => <ExpenseCard key={exp.id} expense={exp} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
