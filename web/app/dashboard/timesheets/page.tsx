'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTimesheetsReport, TimesheetRow } from '@/api/timesheetsApi';
import { reportError } from '@/lib/error-handling';
import TableActions from '@/components/common/TableActions';

const STATUS_COLOR: Record<string, string> = {
  SUBMITTED: 'bg-red-500 text-white',
  APPROVED:  'bg-purple-700 text-white',
  REJECTED:  'bg-emerald-500 text-white',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLOR[status.toUpperCase()] ?? 'bg-slate-400 text-white';
  return (
    <span className={`inline-block px-3 py-1 rounded text-xs font-semibold ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
    </span>
  );
}

const STATUS_FILTERS = ['All', 'Submitted', 'Approved', 'Rejected'] as const;

function formatDate(dateValue: string) {
  return new Date(dateValue).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TimesheetsPage() {
  const router = useRouter();
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
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Time & Attendance</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Track work logs like an approval queue</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">A Keka-style timesheet view should show volume, approval state, and the next submission action clearly.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push('/dashboard/timesheets/add')}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-orange-200 transition-colors hover:bg-orange-600"
            >
              <span className="text-base leading-none">+</span>
              Add Timesheet
            </button>
            <TableActions moduleKey="timesheets" rows={filteredRows} onRefresh={() => getTimesheetsReport({ limit: 100, search: search || undefined }).then((r) => { setRows(r.data); setTotal(r.total); })} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search work logs</label>
            <input
              type="text"
              placeholder="Search by task, project, employee, or note"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div className="text-sm text-slate-500 lg:text-right">Use the status chips to focus on approvals.</div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entries</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{rows.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hours</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.totalHours.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending approval</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.submitted}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approved</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.approved}</p>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {['Employee','Task','Date','Hours','Status','Project','Notes'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {h} <span className="ml-0.5 text-slate-400">↕</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-400">No timesheets found.</td></tr>
            ) : filteredRows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-4 text-slate-700">
                  {row.employee ? row.employee.id : (row.employeeId ?? '—')}
                </td>
                <td className="px-4 py-4 font-medium text-orange-600">
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
            ))}
          </tbody>
        </table>
        {!loading && (
          <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            Showing {filteredRows.length} of {total}
          </div>
        )}
      </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Approval flow</p>
            <p className="mt-2 text-sm text-slate-500">Submitted entries are the queue managers should review first. Approved entries are ready for payroll or reporting.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Quick breakdown</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                <span>Submitted</span>
                <span className="font-semibold text-slate-900">{stats.submitted}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                <span>Approved</span>
                <span className="font-semibold text-slate-900">{stats.approved}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                <span>Rejected</span>
                <span className="font-semibold text-slate-900">{stats.rejected}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
