'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getTimesheetsReport, reviewTimesheet, submitTimesheet, TimesheetRow } from '@/api/timesheetsApi';
import { reportError } from '@/lib/error-handling';
import TableActions from '@/components/common/TableActions';
import { useAuthSession } from '@/stores/auth-store';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  APPROVED: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  REJECTED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLOR[status.toUpperCase()] ?? 'bg-slate-400 text-white';
  const label = status.toUpperCase() === 'PENDING' ? 'Draft' : status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'PENDING' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
] as const;

function formatDate(dateValue: string) {
  return new Date(dateValue).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function TimesheetsPage() {
  const session = useAuthSession();
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewTarget, setReviewTarget] = useState<{ id: number; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const reloadTimesheets = useCallback(async () => {
    const response = await getTimesheetsReport({ limit: 100, search: search || undefined });
    setRows(response.data);
    setTotal(response.total);
  }, [search]);

  useEffect(() => {
    async function loadTimesheets() {
      try {
        await reloadTimesheets();
      } catch (error) {
        reportError(error, 'Unable to load timesheets');
      } finally {
        setLoading(false);
      }
    }

    loadTimesheets();
  }, [reloadTimesheets]);

  const asyncAction = async (action: () => Promise<unknown>) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await action();
      await reloadTimesheets();
      setReviewTarget(null);
      setReviewReason('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update this timesheet.';
      setActionError(message);
      reportError(error, 'Timesheet review action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesSearch =
          row.task.toLowerCase().includes(search.toLowerCase()) ||
          String(row.employee?.id ?? row.employeeId ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (row.project ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (row.notes ?? '').toLowerCase().includes(search.toLowerCase());
        const matchesStatus = !statusFilter || row.status.toUpperCase() === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [rows, search, statusFilter],
  );

  const stats = useMemo(() => {
    const draft = rows.filter((row) => row.status.toUpperCase() === 'PENDING').length;
    const submitted = rows.filter((row) => row.status.toUpperCase() === 'SUBMITTED').length;
    const approved = rows.filter((row) => row.status.toUpperCase() === 'APPROVED').length;
    const rejected = rows.filter((row) => row.status.toUpperCase() === 'REJECTED').length;
    const totalHours = rows.reduce((sum, row) => sum + (row.hours ?? 0), 0);
    return { draft, submitted, approved, rejected, totalHours };
  }, [rows]);

  const isReviewer = ['ADMIN', 'HR', 'SUPER_ADMIN', 'MANAGER'].includes(session.role);

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

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Entries</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{rows.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hours</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.totalHours.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Draft</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.draft}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Submitted</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.submitted}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Approved</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.approved}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rejected</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.rejected}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === filter.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {['Employee', 'Task', 'Date', 'Hours', 'Status', 'Project', 'Notes', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-slate-400">Loading…</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-slate-400">No timesheets found.</td>
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
                  <td className="px-4 py-4">
                    <StatusBadge status={row.status} />
                    {row.status.toUpperCase() === 'SUBMITTED' && row.submittedAt && (
                      <p className="mt-1 text-xs text-slate-400">Submitted {formatDate(row.submittedAt)}</p>
                    )}
                    {row.reviewedAt && row.reviewedByUser && (
                      <p className="mt-1 text-xs text-slate-400">Reviewed by {row.reviewedByUser.name}</p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-slate-600">{row.project ?? '—'}</td>
                  <td className="px-4 py-4 text-slate-600">
                    <div className="max-w-52 truncate">{row.notes ?? '—'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {row.createdByUserId === session.user?.id && ['PENDING', 'REJECTED'].includes(row.status.toUpperCase()) && (
                        <>
                          <Link href={`/dashboard/timesheets/${row.id}/edit`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            Edit
                          </Link>
                          <button type="button" disabled={actionLoading} onClick={() => void asyncAction(() => submitTimesheet(row.id))} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                            {row.status.toUpperCase() === 'REJECTED' ? 'Resubmit' : 'Submit'}
                          </button>
                        </>
                      )}
                      {isReviewer && row.createdByUserId !== session.user?.id && row.status.toUpperCase() === 'SUBMITTED' && (
                        <>
                          <button type="button" disabled={actionLoading} onClick={() => void asyncAction(() => reviewTimesheet(row.id, 'APPROVED'))} className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50">
                            Approve
                          </button>
                          <button type="button" disabled={actionLoading} onClick={() => { setReviewTarget({ id: row.id, decision: 'REJECTED' }); setReviewReason(''); setActionError(null); }} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                    {row.status.toUpperCase() === 'REJECTED' && row.rejectionReason && <p className="mt-2 max-w-48 text-xs text-rose-600">{row.rejectionReason}</p>}
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

        {reviewTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4" role="presentation">
            <section role="dialog" aria-modal="true" aria-labelledby="reject-timesheet-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 id="reject-timesheet-title" className="text-lg font-semibold text-slate-900">Return timesheet</h2>
              <p className="mt-1 text-sm text-slate-500">Add a brief reason so the employee knows what to update.</p>
              <textarea value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} maxLength={1000} rows={4} className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100" placeholder="Reason for returning this entry" />
              {actionError && <p className="mt-3 text-sm text-rose-600">{actionError}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={actionLoading} onClick={() => setReviewTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="button" disabled={actionLoading || !reviewReason.trim()} onClick={() => void asyncAction(() => reviewTimesheet(reviewTarget.id, 'REJECTED', reviewReason.trim()))} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{actionLoading ? 'Saving…' : 'Return for edits'}</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
