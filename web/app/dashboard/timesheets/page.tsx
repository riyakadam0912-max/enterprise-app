'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getTimesheetsReport, TimesheetRow } from '@/api/timesheetsApi';
import { reportError } from '@/lib/error-handling';
import TableActions from '@/components/common/TableActions';

const STATUS_COLOR: Record<string, string> = {
  SUBMITTED: 'bg-red-500 text-white',
  APPROVED: 'bg-purple-700 text-white',
  REJECTED: 'bg-emerald-500 text-white',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLOR[status.toUpperCase()] ?? 'bg-slate-400 text-white';
  return (
    <span className={`inline-block rounded px-3 py-1 text-xs font-semibold ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
    </span>
  );
}

const STATUS_FILTERS = ['All', 'Submitted', 'Approved', 'Rejected'] as const;

function formatDate(dateValue: string) {
  return new Date(dateValue).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function TimesheetsPage() {
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('All');

  useEffect(() => {
    async function loadTimesheets() {
      try {
        const response = await getTimesheetsReport({ limit: 100, search: search || undefined });
        setRows(response.data);
        setTotal(response.total);
      } catch (error) {
        reportError(error, 'Unable to load timesheets');
      } finally {
        setLoading(false);
      }
    }

    loadTimesheets();
  }, [search]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesSearch =
          row.task.toLowerCase().includes(search.toLowerCase()) ||
          String(row.employee?.id ?? row.employeeId ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (row.project ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (row.notes ?? '').toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'All' || row.status.toLowerCase() === statusFilter.toLowerCase();
        return matchesSearch && matchesStatus;
      }),
    [rows, search, statusFilter],
  );

  const stats = useMemo(() => {
    const submitted = rows.filter((row) => row.status.toUpperCase() === 'SUBMITTED').length;
    const approved = rows.filter((row) => row.status.toUpperCase() === 'APPROVED').length;
    const rejected = rows.filter((row) => row.status.toUpperCase() === 'REJECTED').length;
    const totalHours = rows.reduce((sum, row) => sum + (row.hours ?? 0), 0);
    return { submitted, approved, rejected, totalHours };
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-600">Time & Attendance</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Timesheets</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-md">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search task, project, employee..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <TableActions
              moduleKey="timesheets"
              rows={filteredRows}
              onRefresh={() =>
                getTimesheetsReport({ limit: 100, search: search || undefined }).then((r) => {
                  setRows(r.data);
                  setTotal(r.total);
                })
              }
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Entries</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{rows.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hours</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.totalHours.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Submitted</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.submitted}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Approved</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.approved}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === filter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {['Employee', 'Task', 'Date', 'Hours', 'Status', 'Project', 'Notes'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-slate-400">Loading…</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-slate-400">No timesheets found.</td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                  <td className="px-4 py-4 text-slate-700">{row.employee ? row.employee.name : row.employeeId ?? '—'}</td>
                  <td className="px-4 py-4 font-medium text-slate-700">
                    <div className="max-w-52 truncate">{row.task}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-slate-600">{formatDate(row.date)}</td>
                  <td className="px-4 py-4 text-slate-700">{row.hours}</td>
                  <td className="px-4 py-4"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-4 text-slate-600">{row.project ?? '—'}</td>
                  <td className="px-4 py-4 text-slate-600">
                    <div className="max-w-52 truncate">{row.notes ?? '—'}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && (
          <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            Showing {filteredRows.length} of {total}
          </div>
        )}
      </div>
    </div>
  );
}
