'use client';

import React, { useState, useMemo } from 'react';
import { TimesheetFilters } from '../../api/timesheetsApi';
import { useTimesheetsReport } from '../../hooks/useTimesheets';
import TimesheetFiltersBar from './TimesheetFiltersBar';
import TimesheetTable from './TimesheetTable';

type SortField = 'employee' | 'date' | 'hours' | 'status' | 'task';
type SortDir = 'asc' | 'desc';

export default function TimesheetsReport() {
  const [filters, setFilters] = useState<TimesheetFilters>({ page: 1, limit: 10 });
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data, loading, error } = useTimesheetsReport({ ...filters, search: search || undefined });

  const rows = useMemo(() => {
    const list = Array.isArray(data?.data) ? data.data : [];
    return list.slice().sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortField === 'employee') {
        av = a.employee?.name ?? '';
        bv = b.employee?.name ?? '';
      } else if (sortField === 'date') {
        av = a.date;
        bv = b.date;
      } else if (sortField === 'hours') {
        av = a.hours;
        bv = b.hours;
      } else if (sortField === 'status') {
        av = a.status;
        bv = b.status;
      } else if (sortField === 'task') {
        av = a.task;
        bv = b.task;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const total = data?.total ?? 0;
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800">Timesheets</h2>
        <div className="flex items-center gap-2">
          {searchOpen && (
            <input
              autoFocus
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }}
              className="w-40 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          )}
          <button
            onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setSearch(''); }}
            title="Search"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <TimesheetFiltersBar filters={filters} onChange={setFilters} />

      {/* Error */}
      {error && (
        <div className="text-red-500 text-sm py-4">{error}</div>
      )}

      {/* Table */}
      <TimesheetTable
        rows={rows}
        loading={loading}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => setFilters((f) => ({ ...f, limit: Number(e.target.value), page: 1 }))}
              className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none bg-white"
            >
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <span className="text-sm text-slate-500">
            Showing {from}–{to} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Previous
            </button>
            <span className="px-3 text-sm text-slate-600">{page} / {totalPages}</span>
            <button
              onClick={() => setFilters((f) => ({ ...f, page: Math.min(totalPages, (f.page ?? 1) + 1) }))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
