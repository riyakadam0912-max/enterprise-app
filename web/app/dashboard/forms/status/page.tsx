'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getFormSubmissions, FormSubmission, FormSubmissionStatus } from '@/api/formSubmissionsApi';
import { getLeaveRequests, LeaveRequest } from '@/api/leaveRequestsApi';
import { getExpenses, Expense } from '@/api/expensesApi';
import { getTasks, Task } from '@/api/tasksApi';
import { useAuthSession } from '@/stores/auth-store';
import { reportError } from '@/lib/error-handling';

const STATUS_COLOR: Record<FormSubmissionStatus, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-700',
  REJECTED:  'bg-rose-100 text-rose-700',
  PROCESSED: 'bg-emerald-100 text-emerald-700',
};

function fmtDateTime(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function prettyStatus(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-block px-3 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700">
      {prettyStatus(status)}
    </span>
  );
}

function OtherSubmissions({
  leaveRequests,
  expenses,
  tasks,
}: {
  leaveRequests: LeaveRequest[];
  expenses: Expense[];
  tasks: Task[];
}) {
  const rows = [
    ...leaveRequests.map((request) => ({
      id: `leave-${request.id}`,
      type: 'Leave request',
      subject: `${prettyStatus(request.leaveType)} leave`,
      date: request.appliedOn,
      status: request.status,
    })),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      type: 'Expense',
      subject: expense.description || expense.category || 'Expense submission',
      date: expense.expenseDate,
      status: expense.status,
    })),
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      type: 'Task',
      subject: task.taskName,
      date: task.createdAt,
      status: task.status,
    })),
  ].sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''));

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          Other Submissions
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">{rows.length}</span>
        </h2>
        <p className="text-xs text-slate-400">Leave requests, expenses, and tasks assigned to you</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <p className="py-14 text-center text-sm font-medium text-slate-500">No other submissions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Type', 'Submission', 'Date', 'Current Status'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{row.type}</td>
                    <td className="px-4 py-3 text-slate-600">{row.subject}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(row.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function SubmissionsTable({
  rows,
  mode,
}: {
  rows: FormSubmission[];
  mode: 'mine' | 'approvals';
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-slate-400">
        <svg viewBox="0 0 24 24" className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" />
        </svg>
        <p className="text-sm font-medium text-slate-500">
          {mode === 'mine' ? 'No submissions yet' : 'Nothing requires your approval right now'}
        </p>
      </div>
    );
  }

  const headers =
    mode === 'mine'
      ? ['Form', 'Submission Date', 'Current Status', 'Current Approver', 'Last Updated', 'Open']
      : ['Form', 'Submitted By', 'Submission Date', 'Current Status', 'Approval Stage', 'Open'];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{row.form}</td>
              {mode === 'approvals' ? (
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.submittedBy ?? '—'}</td>
              ) : null}
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDateTime(row.submissionDate)}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`inline-block px-3 py-1 rounded text-xs font-semibold ${STATUS_COLOR[row.status as FormSubmissionStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                  {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                {mode === 'mine' ? (row.reviewer ?? '—') : (row.reviewer ? 'Assigned reviewer' : 'Awaiting reviewer')}
              </td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                {mode === 'mine' ? fmtDateTime(row.updatedAt) : (row.reviewDate ? fmtDate(row.reviewDate) : 'Pending')}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <Link
                  href={`/dashboard/forms/status/${row.id}`}
                  className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FormStatusPage() {
  const router = useRouter();
  const { user } = useAuthSession();
  const [rows, setRows] = useState<FormSubmission[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const myName = normalizeText(user?.name);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getFormSubmissions(), getLeaveRequests(), getExpenses(), getTasks()])
      .then(([formList, leaveList, expenseList, taskList]) => {
        if (cancelled) return;
        setRows(formList);
        setLeaveRequests(leaveList);
        setExpenses(expenseList);
        setTasks(taskList);
      })
      .catch((e) => { reportError(e, 'Unable to load form statuses'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const { mySubmissions, pendingApprovals } = useMemo(() => {
    const mine: FormSubmission[] = [];

    for (const r of rows) {
      if (normalizeText(r.submittedBy) === myName) {
        mine.push(r);
      }
    }

    return { mySubmissions: mine, pendingApprovals: [] as FormSubmission[] };
  }, [rows, myName]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 min-w-0 flex-wrap">
        <button
          type="button"
          onClick={() => router.push('/dashboard/forms')}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-orange-600"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Forms
        </button>
        <span className="text-slate-300">/</span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Form Status</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track your submissions and pending reviews</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : (
        <>
          {pendingApprovals.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  Pending Approvals / Reviews
                  <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-600 text-xs font-medium">
                    {pendingApprovals.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Form submissions assigned to you for review</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <SubmissionsTable rows={pendingApprovals} mode="approvals" />
              </div>
            </section>
          )}

          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                My Submissions
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">
                  {mySubmissions.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">Forms you have submitted</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <SubmissionsTable rows={mySubmissions} mode="mine" />
            </div>
          </section>
          <OtherSubmissions leaveRequests={leaveRequests} expenses={expenses} tasks={tasks} />
        </>
      )}
    </div>
  );
}
