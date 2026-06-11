'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getFormSubmissions, deleteFormSubmission,
  FormSubmission, FormSubmissionStatus,
} from '../../../src/api/formSubmissionsApi';
import { reportError } from '@/lib/error-handling';

const STATUS_COLOR: Record<FormSubmissionStatus, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-700',
  REJECTED:  'bg-teal-500 text-white',
  PROCESSED: 'bg-purple-600 text-white',
};

function fmtDateTime(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AllFormSubmissionsPage() {
  const router = useRouter();
  const [rows, setRows]         = useState<FormSubmission[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    async function loadSubmissions() {
      try {
        setRows(await getFormSubmissions());
      } catch (error) {
        reportError(error, 'Unable to load form submissions');
      } finally {
        setLoading(false);
      }
    }

    loadSubmissions();
  }, []);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.form.toLowerCase().includes(q) ||
      (r.submittedBy ?? '').toLowerCase().includes(q) ||
      (r.reviewer    ?? '').toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  });

  async function handleDelete(id: number) {
    if (!confirm('Delete this submission?')) return;
    setDeleteId(id);
    try {
      await deleteFormSubmission(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert('Failed to delete.');
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-800">All Form Submissions</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-orange-400 w-44"
            />
          </div>
          <button
            onClick={() => router.push('/dashboard/forms/add')}
            className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            + Add
          </button>
          <button
            onClick={() => router.push('/dashboard/forms/statuses')}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
          >
            Statuses
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="text-4xl mb-3">📋</span>
            <p className="text-sm font-medium">No form submissions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Form', 'Submitted By', 'Submission Date', 'Data', 'Status', 'Reviewer', 'Review Date', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{row.form}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.submittedBy ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDateTime(row.submissionDate)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{row.data ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block px-3 py-1 rounded text-xs font-semibold ${STATUS_COLOR[row.status as FormSubmissionStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.reviewer ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(row.reviewDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/forms/${row.id}/edit`)}
                          className="text-xs text-gray-500 hover:text-orange-500 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={deleteId === row.id}
                          className="text-xs text-gray-500 hover:text-red-500 transition-colors disabled:opacity-40"
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
        )}
      </div>

      {!loading && (
        <p className="mt-3 text-xs text-gray-400">Showing {filtered.length} of {rows.length}</p>
      )}
    </div>
  );
}
