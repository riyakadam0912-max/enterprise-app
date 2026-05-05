'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLedgerEntry } from '../../../../src/api/ledgerEntriesApi';

export default function AddLedgerEntryPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    date: '',
    description: '',
    debit: '',
    credit: '',
    account: '',
    invoice: '',
    expense: '',
    balance: '',
    reference: '',
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  function handleReset() {
    setForm({ date: '', description: '', debit: '', credit: '', account: '', invoice: '', expense: '', balance: '', reference: '' });
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createLedgerEntry({
        date:        form.date        || undefined,
        description: form.description || undefined,
        debit:       form.debit       ? parseFloat(form.debit)   : undefined,
        credit:      form.credit      ? parseFloat(form.credit)  : undefined,
        account:     form.account     || undefined,
        invoice:     form.invoice     || undefined,
        expense:     form.expense     || undefined,
        balance:     form.balance     ? parseFloat(form.balance) : undefined,
        reference:   form.reference   || undefined,
      });
      router.push('/dashboard/ledger-entries');
    } catch {
      setError('Failed to save ledger entry. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-orange-400 bg-white';
  const labelCls = 'w-44 shrink-0 text-sm text-gray-600 font-medium pt-1.5';
  const rowCls   = 'flex items-start gap-3';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => router.push('/dashboard/ledger-entries')}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ‹
        </button>
        <h1 className="text-base font-semibold text-gray-800">Add Ledger Entry</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-lg max-w-2xl"
      >
        {/* Form title bar */}
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <span className="text-sm font-semibold text-gray-700">Ledger Entries</span>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* Date */}
          <div className={rowCls}>
            <label className={labelCls}>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div className={rowCls}>
            <label className={labelCls}>Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Debit */}
          <div className={rowCls}>
            <label className={labelCls}>Debit</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.debit}
              onChange={(e) => set('debit', e.target.value)}
              placeholder="#######.##"
              className={inputCls}
            />
          </div>

          {/* Credit */}
          <div className={rowCls}>
            <label className={labelCls}>Credit</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.credit}
              onChange={(e) => set('credit', e.target.value)}
              placeholder="#######.##"
              className={inputCls}
            />
          </div>

          {/* Account */}
          <div className={rowCls}>
            <label className={labelCls}>Account</label>
            <input
              type="text"
              value={form.account}
              onChange={(e) => set('account', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Invoice */}
          <div className={rowCls}>
            <label className={labelCls}>Invoice</label>
            <input
              type="text"
              value={form.invoice}
              onChange={(e) => set('invoice', e.target.value)}
              placeholder="-Select-"
              className={inputCls}
            />
          </div>

          {/* Expense */}
          <div className={rowCls}>
            <label className={labelCls}>Expense</label>
            <input
              type="text"
              value={form.expense}
              onChange={(e) => set('expense', e.target.value)}
              placeholder="-Select-"
              className={inputCls}
            />
          </div>

          {/* Balance */}
          <div className={rowCls}>
            <label className={labelCls}>Balance</label>
            <input
              type="number"
              step="0.01"
              value={form.balance}
              onChange={(e) => set('balance', e.target.value)}
              placeholder="#######.##"
              className={inputCls}
            />
          </div>

          {/* Reference */}
          <div className={rowCls}>
            <label className={labelCls}>Reference</label>
            <input
              type="text"
              value={form.reference}
              onChange={(e) => set('reference', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
