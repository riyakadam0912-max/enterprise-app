'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createExpense } from '@/api/expensesApi';

const CATEGORIES = ['Office Supplies', 'Marketing', 'Utilities', 'Training', 'Travel', 'Other'];
const STATUSES   = ['PENDING', 'APPROVED', 'REJECTED'];

const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400';

export default function AddExpensePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    expenseDate:  '',
    category:     '',
    description:  '',
    amount:       '',
    currency:     'INR',
    receiptImage: '',
    approvedBy:   '',
    status:       '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(key: keyof typeof form, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createExpense({
        expenseDate:  form.expenseDate  || undefined,
        category:     form.category     || undefined,
        description:  form.description.trim()  || undefined,
        amount:       form.amount ? parseFloat(form.amount) : undefined,
        currency:     form.currency.trim()     || undefined,
        receiptImage: form.receiptImage.trim() || undefined,
        approvedBy:   form.approvedBy.trim()   || undefined,
        status:       form.status       || undefined,
      });
      router.push('/dashboard/expenses');
    } catch {
      setError('Failed to create expense. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Expenses</h1>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

        {/* Expense Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expense Date</label>
          <input
            type="date"
            className={`${field} border-orange-400`}
            value={form.expenseDate}
            onChange={(e) => set('expenseDate', e.target.value)}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select className={field} value={form.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">-Select-</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            className={field}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Enter description"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={field}
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder="#######.##"
          />
        </div>

        {/* Currency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <input
            className={field}
            value={form.currency}
            onChange={(e) => set('currency', e.target.value)}
            placeholder="INR"
          />
        </div>

        {/* Receipt Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Image</label>
          <input
            className={field}
            value={form.receiptImage}
            onChange={(e) => set('receiptImage', e.target.value)}
            placeholder="https://"
          />
        </div>

        {/* Approved By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Approved By</label>
          <input
            className={field}
            value={form.approvedBy}
            onChange={(e) => set('approvedBy', e.target.value)}
            placeholder="Approver name"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select className={field} value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">-Select-</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Submit'}
          </button>
          <button
            type="button"
            onClick={() => setForm({ expenseDate:'', category:'', description:'', amount:'', currency:'', receiptImage:'', approvedBy:'', status:'' })}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
