'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDynamicForms, removeDynamicForm } from '@/hooks/useDynamicForms';

const STATUS_STYLES: Record<string, string> = {
  Archived: 'bg-purple-600 text-white',
  Draft:    'bg-green-500 text-white',
  Active:   'bg-blue-500 text-white',
  Inactive: 'bg-slate-400 text-white',
};

export default function AllDynamicFormsPage() {
  const { forms, loading, error, refetch: reload } = useDynamicForms();
  const [deleting, setDeleting] = useState<number | null>(null);

  async function handleDelete(id: number) {
    if (!confirm('Delete this form?')) return;
    setDeleting(id);
    try {
      await removeDynamicForm(id);
      reload();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Dynamic Forms</h1>
          <p className="text-sm text-slate-500 mt-0.5">{forms.length} form{forms.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link
          href="/dashboard/dynamic-forms/add"
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Form
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500">{error}</div>
        ) : forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <svg className="w-16 h-16 text-slate-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-500 font-medium">No forms yet</p>
            <Link href="/dashboard/dynamic-forms/add" className="mt-3 text-orange-500 hover:text-orange-600 text-sm font-medium">
              Create your first form →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Form Name', 'Form Code', 'Description', 'Created By', 'Status', 'Form Type', 'Target Module', 'Actions'].map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {forms.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-orange-600 whitespace-nowrap">{f.formName}</td>
                    <td className="px-4 py-3 text-sm text-green-600 whitespace-nowrap">{f.formCode ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{f.description ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{f.createdBy ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {f.status ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[f.status] ?? 'bg-slate-200 text-slate-700'}`}>
                          {f.status}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{f.formType ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{f.targetModule ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/dynamic-forms/edit/${f.id}`}
                          className="text-xs text-slate-600 hover:text-orange-600 font-medium transition-colors"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(f.id)}
                          disabled={deleting === f.id}
                          className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                        >
                          {deleting === f.id ? '…' : 'Delete'}
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
    </div>
  );
}
