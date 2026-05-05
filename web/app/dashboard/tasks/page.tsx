'use client';

import { useEffect, useState } from 'react';
import {
  deleteTask,
  getTasks,
  reviewTask,
  submitTaskWork,
  Task,
  updateTaskStatus,
} from '@/api/tasksApi';

function fmtDate(d: string | null) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-slate-200 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
};

export default function AllTasksPage() {
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') ?? 'EMPLOYEE' : 'EMPLOYEE';
  const currentUserId = (() => {
    if (typeof window === 'undefined') return null;
    const rawUser = localStorage.getItem('currentUser');
    if (!rawUser) return null;
    try {
      const parsed = JSON.parse(rawUser) as { id?: number };
      return parsed.id ?? null;
    } catch {
      return null;
    }
  })();

  const canManageTasks = role === 'ADMIN' || role === 'MANAGER';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [submitForms, setSubmitForms] = useState<Record<number, { submissionLink: string; note: string }>>({});
  const [reviewForms, setReviewForms] = useState<Record<number, string>>({});

  async function loadTasks() {
    setLoading(true);
    setError('');
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function handleDelete(id: number) {
    if (!confirm('Delete this task?')) return;
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSubmit(taskId: number) {
    const form = submitForms[taskId];
    if (!form?.submissionLink || !form?.note) return;

    setBusy(true);
    try {
      await submitTaskWork(taskId, form);
      await loadTasks();
    } finally {
      setBusy(false);
    }
  }

  async function handleReview(taskId: number, decision: 'APPROVED' | 'REJECTED') {
    setBusy(true);
    try {
      await reviewTask(taskId, {
        decision,
        comment: reviewForms[taskId]?.trim() || undefined,
      });
      await loadTasks();
    } finally {
      setBusy(false);
    }
  }

  async function handleInProgress(taskId: number) {
    setBusy(true);
    try {
      await updateTaskStatus(taskId, 'IN_PROGRESS');
      await loadTasks();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Tasks</h1>
          <p className="text-xs text-gray-500">
            {role} workflow: {role === 'EMPLOYEE' ? 'receive -> work -> submit' : 'assign -> review -> approve/reject'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No tasks found.</div>
        )}
        {tasks.map((task) => {
          const status = task.status?.toUpperCase() ?? 'PENDING';
          const canSubmit = role === 'EMPLOYEE' && task.assignedToUserId === currentUserId;
          return (
            <article key={task.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{task.taskName}</p>
                  <p className="text-xs text-slate-500">{task.project ?? 'N/A'} | Due {fmtDate(task.dueDate)}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_BADGE[status] ?? 'bg-slate-200 text-slate-700'}`}>
                  {status}
                </span>
              </div>

              <p className="text-sm text-slate-600">{task.notes ?? 'No description'}</p>
              <p className="mt-2 text-xs text-slate-500">Assignee: {task.assignedToUser?.name ?? task.assignee ?? 'N/A'}</p>

              {task.submissionLink && (
                <a href={task.submissionLink} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-blue-600 hover:underline">
                  View submitted work
                </a>
              )}

              {task.reviewComment && (
                <p className={`mt-2 text-xs ${status === 'REJECTED' ? 'text-rose-600' : 'text-slate-600'}`}>
                  Feedback: {task.reviewComment}
                </p>
              )}

              {canSubmit && (status === 'PENDING' || status === 'IN_PROGRESS' || status === 'REJECTED') && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <input
                    value={submitForms[task.id]?.submissionLink ?? ''}
                    onChange={(e) =>
                      setSubmitForms((prev) => ({
                        ...prev,
                        [task.id]: { submissionLink: e.target.value, note: prev[task.id]?.note ?? '' },
                      }))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Submission URL"
                  />
                  <input
                    value={submitForms[task.id]?.note ?? ''}
                    onChange={(e) =>
                      setSubmitForms((prev) => ({
                        ...prev,
                        [task.id]: { submissionLink: prev[task.id]?.submissionLink ?? '', note: e.target.value },
                      }))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Submission note"
                  />
                  <div className="md:col-span-2 flex gap-2">
                    <button
                      onClick={() => handleSubmit(task.id)}
                      disabled={busy}
                      className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Submit Work
                    </button>
                    {canManageTasks && (
                      <button
                        onClick={() => handleInProgress(task.id)}
                        disabled={busy}
                        className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Mark In Progress
                      </button>
                    )}
                  </div>
                </div>
              )}

              {canManageTasks && status === 'SUBMITTED' && (
                <div className="mt-3 space-y-2">
                  <input
                    value={reviewForms[task.id] ?? ''}
                    onChange={(e) => setReviewForms((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Review comment"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(task.id, 'APPROVED')}
                      disabled={busy}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview(task.id, 'REJECTED')}
                      disabled={busy}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {canManageTasks && (
                <div className="mt-3">
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="text-xs font-semibold text-rose-600"
                  >
                    Delete Task
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
