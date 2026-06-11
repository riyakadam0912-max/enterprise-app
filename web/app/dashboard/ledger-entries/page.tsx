'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getLedgerEntries,
  deleteLedgerEntry,
  LedgerEntry,
} from '../../../src/api/ledgerEntriesApi';
import TableActions from '@/components/common/TableActions';
import { formatInrCurrency } from '@/utils/formatCurrency';
import { reportError } from '@/lib/error-handling';

export default function LedgerEntriesPage() {
  const router = useRouter();
  const [entries, setEntries]   = useState<LedgerEntry[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadEntries() {
      try {
        setEntries(await getLedgerEntries());
      } catch (error) {
        reportError(error, 'Unable to load ledger entries');
      } finally {
        setLoading(false);
      }
    }

    loadEntries();
  }, []);

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    return (
      (e.description ?? '').toLowerCase().includes(q) ||
      (e.account     ?? '').toLowerCase().includes(q) ||
      (e.invoice     ?? '').toLowerCase().includes(q) ||
      (e.reference   ?? '').toLowerCase().includes(q)
    );
  });

  async function handleDelete() {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await deleteLedgerEntry(deleteId);
      setEntries((prev) => prev.filter((e) => e.id !== deleteId));
    } catch {
      alert('Failed to delete entry.');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  function fmt(v?: number | null) {
    if (v === undefined || v === null) return '—';
    return formatInrCurrency(Number(v), 2);
  }

  function fmtDate(d?: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-semibold text-gray-800">All Ledger Entries</h1>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-7 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-orange-400 w-52"
            />
          </div>
          <button
            onClick={() => router.push('/dashboard/ledger-entries/add')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Entry
          </button>
          <TableActions moduleKey="ledger-entries" rows={filtered} onRefresh={() => getLedgerEntries().then(setEntries)} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date','Description','Debit ($)','Credit ($)','Account','Invoice','Expense','Balance ($)','Reference','Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">
                    No ledger entries found.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{e.description ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmt(e.debit)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmt(e.credit)}</td>
                    <td className="px-4 py-3 text-gray-700">{e.account ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{e.invoice ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{e.expense ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">{fmt(e.balance)}</td>
                    <td className="px-4 py-3 text-gray-700">{e.reference ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => router.push(`/dashboard/ledger-entries/${e.id}/edit`)}
                          className="text-orange-500 hover:text-orange-700 text-xs font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(e.id!)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Footer */}
        {!loading && (
          <div className="px-4 py-2.5 border-t border-gray-200 text-xs text-gray-500">
            Showing {filtered.length} of {entries.length}
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80">
            <h2 className="text-sm font-semibold text-gray-800 mb-2">Delete Ledger Entry</h2>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete this entry? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
