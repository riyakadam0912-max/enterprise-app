'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Deal, DealStage } from '../../api/dealsApi';
import { formatInrCurrency } from '@/utils/formatCurrency';

const STAGE_STYLES: Record<DealStage, string> = {
  NEW:         'bg-slate-100 text-slate-600',
  QUALIFIED:   'bg-blue-100 text-blue-700',
  PROPOSAL:    'bg-purple-100 text-purple-700',
  WON:         'bg-green-100 text-green-700',
  LOST:        'bg-red-100 text-red-700',
};

type SortField = 'title' | 'value' | 'stage' | 'probability' | 'closeDate';
type SortDir   = 'asc' | 'desc';

interface DealsTableProps {
  deals:    Deal[];
  loading:  boolean;
  onDelete: (id: number) => void;
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <span className="ml-1 text-slate-300">↕</span>;
  return <span className="ml-1 text-orange-500">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

export default function DealsTable({ deals, loading, onDelete }: DealsTableProps) {
  const [search,    setSearch]    = useState('');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDir,   setSortDir]   = useState<SortDir>('asc');
  const [page,      setPage]      = useState(1);
  const limit = 10;

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return deals.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.lead?.name ?? '').toLowerCase().includes(q) ||
        (d.employee?.fullName ?? '').toLowerCase().includes(q) ||
        d.stage.toLowerCase().includes(q),
    );
  }, [deals, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortField === 'title')       { av = a.title;              bv = b.title; }
      if (sortField === 'value')       { av = a.value;              bv = b.value; }
      if (sortField === 'stage')       { av = a.stage;              bv = b.stage; }
      if (sortField === 'probability') { av = a.probability ?? -1;  bv = b.probability ?? -1; }
      if (sortField === 'closeDate')   { av = a.closeDate ?? '';     bv = b.closeDate ?? ''; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const paginated  = sorted.slice((page - 1) * limit, page * limit);

  const sortableHeader = (label: string, field: SortField) => (
    <th
      onClick={() => handleSort(field)}
      className="text-left py-3 px-4 font-semibold text-slate-500 cursor-pointer select-none hover:text-slate-700 whitespace-nowrap"
    >
      {label}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </th>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Search + Add button */}
      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          placeholder="Search deals…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300 w-60"
        />
        <Link
          href="/dashboard/deals/add"
          className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Deal
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">No deals found.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {sortableHeader('Title',       'title')}
                  <th className="text-left py-3 px-4 font-semibold text-slate-500">Lead</th>
                  {sortableHeader('Value',       'value')}
                  {sortableHeader('Stage',       'stage')}
                  {sortableHeader('Probability', 'probability')}
                  {sortableHeader('Close Date',  'closeDate')}
                  <th className="text-left py-3 px-4 font-semibold text-slate-500">Owner</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((deal) => (
                  <tr key={deal.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-800">{deal.title}</td>
                    <td className="py-3 px-4 text-slate-600">{deal.lead?.name ?? '—'}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{formatInrCurrency(deal.value)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_STYLES[deal.stage] ?? 'bg-slate-100 text-slate-600'}`}>
                        {deal.stage}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {deal.probability != null ? `${(deal.probability * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{deal.employee?.fullName ?? '—'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/deals/edit/${deal.id}`}
                          className="text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => onDelete(deal.id)}
                          className="text-xs px-2.5 py-1 rounded border border-red-100 text-red-500 hover:bg-red-50 transition-colors"
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

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              Showing {Math.min((page - 1) * limit + 1, sorted.length)}–{Math.min(page * limit, sorted.length)} of {sorted.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Previous
              </button>
              <span className="px-3 text-sm text-slate-600">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
