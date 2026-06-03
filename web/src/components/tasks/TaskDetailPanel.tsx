'use client';

import { useMemo, useState } from 'react';

type DashboardRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

type TaskLike = {
  id: number;
  taskName: string;
  status: string;
  priority?: string | null;
  category?: string | null;
  description?: string | null;
  links?: string | null;
  assignee?: string | null;
  assignedToUserId?: number | null;
  assignedToUser?: { id: number; name: string; email: string } | null;
  assignedByUser?: { id: number; name: string; email: string } | null;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  notes?: string | null;
  submissionLink?: string | null;
  submissionNotes?: string | null;
  reviewComment?: string | null;
  reviewedAt?: string | null;
  reviewedByUser?: { id: number; name: string; email: string } | null;
};

type TaskDetailPanelProps = {
  task: TaskLike | null;
  open: boolean;
  role: DashboardRole;
  currentUserId: number | null;
  onClose: () => void;
  onStartTask: (taskId: number) => Promise<void> | void;
  onSubmitTask: (taskId: number, payload: { submissionLink: string; note: string }) => Promise<void> | void;
  onReviewTask: (taskId: number, payload: { status: 'APPROVED' | 'REJECTED'; remarks: string }) => Promise<void> | void;
  onUpdateStatus?: (taskId: number, status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED') => Promise<void> | void;
  busy?: boolean;
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-slate-200 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-rose-100 text-rose-800',
};

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function initials(name?: string | null) {
  if (!name) return 'NA';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function normalizeTaskStatus(value?: string | null): TaskStatus {
  switch (value?.toUpperCase()) {
    case 'IN_PROGRESS':
    case 'SUBMITTED':
    case 'APPROVED':
    case 'REJECTED':
      return value.toUpperCase() as TaskStatus;
    case 'PENDING':
    default:
      return 'PENDING';
  }
}

export function TaskDetailPanel({
  task,
  open,
  role,
  currentUserId,
  onClose,
  onStartTask,
  onSubmitTask,
  onReviewTask,
  onUpdateStatus,
  busy = false,
}: TaskDetailPanelProps) {
  if (!open || !task) return null;

  return (
    <TaskDetailPanelBody
      key={task.id}
      task={task}
      role={role}
      currentUserId={currentUserId}
      onClose={onClose}
      onStartTask={onStartTask}
      onSubmitTask={onSubmitTask}
      onReviewTask={onReviewTask}
      onUpdateStatus={onUpdateStatus}
      busy={busy}
    />
  );
}

type TaskDetailPanelBodyProps = {
  task: TaskLike;
  role: DashboardRole;
  currentUserId: number | null;
  onClose: () => void;
  onStartTask: (taskId: number) => Promise<void> | void;
  onSubmitTask: (taskId: number, payload: { submissionLink: string; note: string }) => Promise<void> | void;
  onReviewTask: (taskId: number, payload: { status: 'APPROVED' | 'REJECTED'; remarks: string }) => Promise<void> | void;
  onUpdateStatus?: (taskId: number, status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED') => Promise<void> | void;
  busy?: boolean;
};

function TaskDetailPanelBody({
  task,
  role,
  currentUserId,
  onClose,
  onStartTask,
  onSubmitTask,
  onReviewTask,
  onUpdateStatus,
  busy = false,
}: TaskDetailPanelBodyProps) {
  const taskStatus = normalizeTaskStatus(task.status);
  const [currentTime] = useState(() => Date.now());
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [statusDraft, setStatusDraft] = useState<TaskStatus>(() => normalizeTaskStatus(task.status));

  const isEmployee = role === 'EMPLOYEE';
  const isManagerOrAdmin = role === 'ADMIN' || role === 'MANAGER';
  const isAssignee = Boolean(currentUserId != null && task.assignedToUserId === currentUserId);
  const canEmployeeAct = isEmployee && isAssignee;
  const canReview = isManagerOrAdmin && taskStatus === 'SUBMITTED';
  const canChangeStatus = isManagerOrAdmin && taskStatus !== 'SUBMITTED';
  const showSubmissionSection = canEmployeeAct && (taskStatus === 'IN_PROGRESS' || taskStatus === 'REJECTED');
  const showStartButton = canEmployeeAct && taskStatus === 'PENDING';
  const showAwaitingReview = taskStatus === 'SUBMITTED';
  const showApproved = taskStatus === 'APPROVED';
  const showRejectResubmit = canEmployeeAct && taskStatus === 'REJECTED';

  const links = task.links;
  const referenceLinks = useMemo(() => {
    if (!links) return [];
    return links
      .split(',')
      .map((link) => link.trim())
      .filter(Boolean);
  }, [links]);

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isPastDue = Boolean(dueDate && dueDate.getTime() < currentTime && taskStatus !== 'APPROVED');
  const reviewerName = task.reviewedByUser?.name ?? 'Manager';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div
          className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6"
          style={{ backgroundImage: 'linear-gradient(to right, #ffffff, #f8fafc)' }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task Detail</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{task.taskName}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900"
            aria-label="Close task details"
          >
            X
          </button>
        </div>

        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto space-y-4 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[taskStatus] ?? 'bg-slate-200 text-slate-700'}`}>
              {taskStatus}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PRIORITY_BADGE[(task.priority ?? 'LOW').toUpperCase()] ?? PRIORITY_BADGE.LOW}`}>
              {(task.priority ?? 'LOW').toUpperCase()}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {task.category ?? 'Other'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {initials(task.assignedToUser?.name ?? task.assignee)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Assigned To</p>
                <p className="text-sm text-slate-600">{task.assignedToUser?.name ?? task.assignee ?? 'N/A'}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Assigned By</p>
              <p className="text-sm text-slate-600">{task.assignedByUser?.name ?? 'N/A'}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Due Date</p>
              <p className={`text-sm ${isPastDue ? 'font-semibold text-rose-600' : 'text-slate-600'}`}>{formatDate(task.dueDate)}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Created</p>
              <p className="text-sm text-slate-600">{formatDate(task.createdAt)}</p>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Description / Instructions</h3>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 shadow-sm">
              {task.description?.trim() ? task.description : 'No instructions provided.'}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Reference Links</h3>
            {referenceLinks.length === 0 ? (
              <p className="text-sm text-slate-500">No reference links.</p>
            ) : (
              <div className="space-y-1">
                {referenceLinks.map((link) => (
                  <a
                    key={link}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-sm text-blue-600 hover:underline"
                  >
                    {link}
                  </a>
                ))}
              </div>
            )}
          </div>

          {['SUBMITTED', 'APPROVED', 'REJECTED'].includes(taskStatus) && (
            <div className="space-y-2 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Submission</h3>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 shadow-sm">
                {task.submissionNotes?.trim() ? task.submissionNotes : 'No submission notes provided.'}
              </div>
              {task.submissionLink && (
                <a href={task.submissionLink} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline">
                  {task.submissionLink}
                </a>
              )}
            </div>
          )}

          {task.reviewComment && (
            <div className="space-y-2 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Review Feedback</h3>
              <div className="rounded-2xl border-l-4 border-purple-400 bg-slate-50 p-4 text-sm leading-6 text-slate-700 shadow-sm">
                <p className="font-medium text-slate-900">{reviewerName}{task.reviewedAt ? ` · ${formatDate(task.reviewedAt)}` : ''}</p>
                <p className="mt-2">{task.reviewComment}</p>
              </div>
            </div>
          )}

          <div className="space-y-3 border-t border-slate-200 pt-4">
            {showStartButton && (
              <button
                onClick={() => onStartTask(task.id)}
                disabled={busy}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                Start Task
              </button>
            )}

            {showSubmissionSection && !showRejectResubmit && !showSubmitForm && (
              <button
                onClick={() => setShowSubmitForm(true)}
                disabled={busy}
                className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
              >
                Submit Work
              </button>
            )}

            {showRejectResubmit && !showSubmitForm && (
              <button
                onClick={() => setShowSubmitForm(true)}
                disabled={busy}
                className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
              >
                Resubmit
              </button>
            )}

            {showSubmitForm && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <textarea
                  value={submissionNote}
                  onChange={(e) => setSubmissionNote(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Describe what you completed, what was done, and any notes"
                />
                <input
                  value={submissionLink}
                  onChange={(e) => setSubmissionLink(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Link to your work (GitHub, Google Doc, Figma, etc.)"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => onSubmitTask(task.id, { note: submissionNote.trim(), submissionLink: submissionLink.trim() })}
                    disabled={busy || !submissionNote.trim()}
                    className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                  >
                    Submit for Review
                  </button>
                  <button
                    onClick={() => setShowSubmitForm(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showAwaitingReview && (
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">Awaiting Review</div>
            )}

            {showApproved && (
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">Approved ✓</div>
            )}

            {canReview && !showReviewForm && (
              <button
                onClick={() => setShowReviewForm(true)}
                disabled={busy}
                className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-50"
              >
                Review
              </button>
            )}

            {canChangeStatus && !canReview && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Update task status</p>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(normalizeTaskStatus(e.target.value))}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus?.(task.id, statusDraft)}
                    disabled={busy}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    Update
                  </button>
                </div>
              </div>
            )}

            {showReviewForm && canReview && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Submission details</p>
                  <p className="mt-2 text-xs text-slate-500">Employee: {task.assignedToUser?.name ?? 'N/A'}</p>
                  <p className="text-xs text-slate-500">Submitted: {formatDate(task.updatedAt)}</p>
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                    {task.submissionNotes?.trim() ? task.submissionNotes : 'No submission notes provided.'}
                  </div>
                  {task.submissionLink && (
                    <a href={task.submissionLink} target="_blank" rel="noreferrer" className="mt-3 block text-blue-600 hover:underline">
                      {task.submissionLink}
                    </a>
                  )}
                </div>
                <div className="h-px bg-slate-200" />
                <textarea
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Provide feedback for the employee. Be specific about what was good and what needs improvement."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => onReviewTask(task.id, { status: 'APPROVED', remarks: reviewRemarks.trim() })}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onReviewTask(task.id, { status: 'REJECTED', remarks: reviewRemarks.trim() })}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
                <button
                  onClick={() => setShowReviewForm(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      </aside>
    </>
  );
}
