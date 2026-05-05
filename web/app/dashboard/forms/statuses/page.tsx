'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getFormSubmissionsByStatus,
  FormSubmission, FormSubmissionStatus,
} from '../../../../src/api/formSubmissionsApi';

const STATUSES: FormSubmissionStatus[] = ['SUBMITTED', 'REJECTED', 'PROCESSED'];

const HEADER_COLOR: Record<FormSubmissionStatus, string> = {
  SUBMITTED: 'border-l-4 border-orange-400',
  REJECTED:  'border-l-4 border-orange-400',
  PROCESSED: 'border-l-4 border-orange-400',
};

function fmtDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SubmissionCard({ row }: { row: FormSubmission }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm mb-2">
      <p className="text-sm font-semibold text-gray-800">{row.submittedBy ?? '—'}</p>
      {row.reviewer && (
        <p className="text-xs text-orange-500 mt-0.5">{row.reviewer}</p>
      )}
      {row.submissionDate && (
        <p className="text-xs text-gray-400 mt-1">{fmtDate(row.submissionDate)}</p>
      )}
    </div>
  );
}

export default function FormSubmissionsStatusesPage() {
  const router = useRouter();
  const [grouped, setGrouped]   = useState<Record<string, FormSubmission[]>>({});
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setGrouped(await getFormSubmissionsByStatus()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Statuses</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard/forms/add')}
            className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            + Add
          </button>
          <button
            onClick={() => router.push('/dashboard/forms')}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
          >
            All Submissions
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : (
        <div className="flex gap-5 overflow-x-auto pb-4">
          {STATUSES.map((status) => {
            const cards = grouped[status] ?? [];
            return (
              <div key={status} className="shrink-0 w-72">
                {/* Column header */}
                <div className={`flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-t-lg ${HEADER_COLOR[status]}`}>
                  <span className="text-sm font-semibold text-gray-800">
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                  </span>
                  <span className="text-xs text-gray-400">{cards.length}</span>
                </div>

                {/* Cards */}
                <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg p-2 min-h-32">
                  {cards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                      <svg viewBox="0 0 24 24" className="w-10 h-10 mb-2 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                        <rect x="8" y="2" width="8" height="4" rx="1"/>
                        <circle cx="12" cy="14" r="1" fill="currentColor"/>
                        <line x1="12" y1="10" x2="12" y2="10.01"/>
                      </svg>
                      <p className="text-xs">No Records in {status.charAt(0) + status.slice(1).toLowerCase()}</p>
                    </div>
                  ) : (
                    cards.map((row) => <SubmissionCard key={row.id} row={row} />)
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
