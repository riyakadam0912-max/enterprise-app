'use client';

import { useLeadsByStatus } from '@/hooks/useLeads';

const FIXED_STATUSES = ['New', 'Contacted', 'Closed Won', 'Closed Lost', 'Proposal Sent', 'Qualified'];

function EmptyCard({ status }: { status: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        <circle cx="18" cy="18" r="4" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 18h4M18 16v4" />
      </svg>
      <p className="text-slate-400 text-sm">No Records in {status}</p>
    </div>
  );
}

export default function LeadStatusesPage() {
  const { grouped, loading, error } = useLeadsByStatus();

  const extraStatuses = Object.keys(grouped).filter((s) => !FIXED_STATUSES.includes(s));
  const columns = [...FIXED_STATUSES, ...extraStatuses];

  if (loading) return <div className="p-6 flex items-center justify-center min-h-64 text-slate-400">Loading…</div>;
  if (error)   return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Statuses</h1>
        <p className="text-sm text-slate-500 mt-0.5">Leads grouped by status</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((status) => {
          const items = grouped[status] ?? [];
          return (
            <div key={status} className="flex-none w-72 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Column header */}
              <div className="px-4 py-3 border-l-4 border-l-orange-500 border-t-slate-200 border-r-slate-200 bg-white">
                <h2 className="text-sm font-semibold text-slate-800">{status}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{items.length} lead{items.length !== 1 ? 's' : ''}</p>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-2 min-h-32">
                {items.length === 0 ? (
                  <EmptyCard status={status} />
                ) : (
                  items.map((lead) => (
                    <div key={lead.id} className="bg-slate-50 hover:bg-slate-100 rounded-lg px-3 py-3 border border-slate-100 transition-colors">
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{lead.name}</p>
                      {lead.leadOwner && (
                        <p className="text-xs text-orange-500 mt-0.5">{lead.leadOwner}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
