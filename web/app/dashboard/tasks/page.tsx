'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getTasks,
  reviewTask,
  submitTaskWork,
  Task,
  updateTaskStatus,
} from '@/api/tasksApi';
import { useStableNow } from '@/hooks/useStableNow';

type DashboardRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';
type TaskFilter = 'all' | 'mine' | 'needs-review';
type DetailTab = 'overview' | 'submission' | 'chat';
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

type Session = {
  role: DashboardRole;
  currentUserId: number | null;
  currentUserName: string;
};

type ChatMessage = {
  id: string;
  senderName: string;
  senderId: number | 'system';
  content: string;
  createdAt: string;
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const PRIORITY_BADGE: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-green-100 text-green-700',
};

const STATUS_PROGRESS: Record<string, number> = {
  PENDING: 0,
  IN_PROGRESS: 40,
  SUBMITTED: 80,
  APPROVED: 100,
  REJECTED: 80,
};

const STATUS_BAR: Record<string, string> = {
  PENDING: 'bg-gray-300',
  IN_PROGRESS: 'bg-blue-500',
  SUBMITTED: 'bg-amber-500',
  APPROVED: 'bg-green-500',
  REJECTED: 'bg-red-500',
};

function readSession(): Session {
  if (typeof window === 'undefined') {
    return { role: 'EMPLOYEE', currentUserId: null, currentUserName: '' };
  }

  const role = (localStorage.getItem('role') ?? 'EMPLOYEE') as DashboardRole;
  let currentUserId: number | null = null;
  let currentUserName = '';

  try {
    const rawUser = localStorage.getItem('currentUser');
    if (rawUser) {
      const parsed = JSON.parse(rawUser) as { id?: number; name?: string };
      currentUserId = parsed.id ?? null;
      currentUserName = parsed.name ?? '';
    }
  } catch {
    currentUserId = null;
    currentUserName = '';
  }

  return { role, currentUserId, currentUserName };
}

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

function normalizeTaskStatus(status?: string | null): TaskStatus {
  switch (status?.toUpperCase()) {
    case 'IN_PROGRESS':
    case 'SUBMITTED':
    case 'APPROVED':
    case 'REJECTED':
      return status.toUpperCase() as TaskStatus;
    case 'PENDING':
    default:
      return 'PENDING';
  }
}

function isOverdue(task: Task, currentTime: number) {
  if (!task.dueDate) return false;
  return new Date(task.dueDate).getTime() < currentTime && task.status?.toUpperCase() !== 'APPROVED';
}

function parseLinks(value?: string | null) {
  if (!value) return [];
  return value
    .split(',')
    .map((link) => link.trim())
    .filter(Boolean);
}

function progressForStatus(status: string) {
  return STATUS_PROGRESS[status] ?? 0;
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function isForbiddenTaskError(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'status' in error
    && (error as { status?: number }).status === 403,
  );
}

function TaskRow({
  task,
  selected,
  onSelect,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
}) {
  const currentTime = useStableNow();
  const status = task.status?.toUpperCase() ?? 'PENDING';
  const priority = (task.priority?.toUpperCase() ?? 'LOW') as keyof typeof PRIORITY_BADGE;
  const pastDue = isOverdue(task, currentTime);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex h-full w-full flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 transition group-hover:text-blue-700">{task.taskName}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.LOW}`}>
              {priority}
            </span>
          </div>
          <p className={`mt-3 text-xs ${pastDue ? 'font-medium text-red-600' : 'text-slate-500'}`}>
            {task.dueDate ? `Due ${formatDate(task.dueDate)}${pastDue ? ' !' : ''}` : 'No due date'}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_BADGE[status] ?? STATUS_BADGE.PENDING}`}>
          {status}
        </span>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${STATUS_BAR[status] ?? STATUS_BAR.PENDING}`}
          style={{ width: `${progressForStatus(status)}%` }}
        />
      </div>
    </button>
  );
}

function TaskDetailPanel({
  task,
  role,
  currentUserId,
  currentUserName,
  activeTab,
  onTabChange,
  onClose,
  onStartTask,
  onSubmitTask,
  onReviewTask,
  onUpdateStatus,
  busy,
}: {
  task: Task | null;
  role: DashboardRole;
  currentUserId: number | null;
  currentUserName: string;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
  onStartTask: (taskId: number) => Promise<void>;
  onSubmitTask: (taskId: number, payload: { submissionLink: string; note: string }) => Promise<void>;
  onReviewTask: (taskId: number, payload: { status: 'APPROVED' | 'REJECTED'; remarks: string }) => Promise<void>;
  onUpdateStatus: (taskId: number, status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED') => Promise<void>;
  busy: boolean;
}) {
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [statusDraft, setStatusDraft] = useState<TaskStatus>(normalizeTaskStatus(task?.status));
  const [chatDraft, setChatDraft] = useState('');
  const [chatMessagesByTask, setChatMessagesByTask] = useState<Record<number, ChatMessage[]>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatIntervalRef = useRef<number | null>(null);
  const currentTime = useStableNow();

  const taskStatus = normalizeTaskStatus(task?.status);
  const isEmployee = role === 'EMPLOYEE';
  const isManagerOrAdmin = role === 'ADMIN' || role === 'MANAGER';
  const isAssignee = Boolean(task && currentUserId != null && task.assignedToUserId === currentUserId);
  const canEmployeeAct = isEmployee && isAssignee;
  const canReview = isManagerOrAdmin && taskStatus === 'SUBMITTED';
  const canChangeStatus = isManagerOrAdmin && taskStatus !== 'SUBMITTED';
  const showEmployeeStart = canEmployeeAct && taskStatus === 'PENDING';
  const showEmployeeSubmit = canEmployeeAct && (taskStatus === 'IN_PROGRESS' || taskStatus === 'REJECTED');
  const showAwaitingReview = canEmployeeAct && taskStatus === 'SUBMITTED';
  const showApproved = canEmployeeAct && taskStatus === 'APPROVED';
  const referenceLinks = useMemo(() => parseLinks(task?.links), [task?.links]);
  const submissionDate = task?.updatedAt ?? task?.createdAt ?? null;
  const taskId = task?.id ?? null;
  const chatMessages = useMemo(
    () => (taskId == null ? [] : chatMessagesByTask[taskId] ?? []),
    [chatMessagesByTask, taskId],
  );

  useEffect(() => {
    if (activeTab !== 'chat' || !task) {
      if (chatIntervalRef.current) {
        window.clearInterval(chatIntervalRef.current);
        chatIntervalRef.current = null;
      }
      return undefined;
    }

    if (chatIntervalRef.current) {
      window.clearInterval(chatIntervalRef.current);
    }

    chatIntervalRef.current = window.setInterval(() => {
      setChatMessagesByTask((prev) => ({ ...prev }));
    }, 10000);

    return () => {
      if (chatIntervalRef.current) {
        window.clearInterval(chatIntervalRef.current);
        chatIntervalRef.current = null;
      }
    };
  }, [activeTab, task]);

  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, chatMessages]);

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center px-8 py-12 text-center">
        <div>
          <div className="text-5xl">📋</div>
          <p className="mt-4 text-sm text-gray-500">Select a task to view details</p>
        </div>
      </div>
    );
  }

  const activeTask = task;

  const statusClass = STATUS_BADGE[taskStatus] ?? STATUS_BADGE.PENDING;
  const priority = (activeTask.priority?.toUpperCase() ?? 'LOW') as keyof typeof PRIORITY_BADGE;
  const priorityClass = PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.LOW;
  const category = activeTask.category?.trim() || 'Other';
  const pastDue = isOverdue(activeTask, currentTime);

  function upsertChatMessage(message: ChatMessage) {
    setChatMessagesByTask((prev) => ({
      ...prev,
      [activeTask.id]: [...(prev[activeTask.id] ?? []), message],
    }));
  }

  async function handleSubmitForm() {
    if (!submissionNote.trim()) return;
    await onSubmitTask(activeTask.id, {
      note: submissionNote.trim(),
      submissionLink: submissionLink.trim(),
    });
    setShowSubmitForm(false);
    setSubmissionNote('');
    setSubmissionLink('');
    if (chatMessages.length === 0) {
      upsertChatMessage({
        id: `${activeTask.id}-submission-${Date.now()}`,
        senderId: currentUserId ?? 'system',
        senderName: currentUserName || 'You',
        content: `Submission added: ${submissionNote.trim()}`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async function handleReviewAction(status: 'APPROVED' | 'REJECTED') {
    await onReviewTask(activeTask.id, { status, remarks: reviewRemarks.trim() });
    setReviewRemarks('');
  }

  async function handleStatusChange() {
    await onUpdateStatus(activeTask.id, statusDraft);
  }

  async function handleSendChat() {
    if (!chatDraft.trim()) return;
    upsertChatMessage({
      id: `${activeTask.id}-chat-${Date.now()}`,
      senderId: currentUserId ?? 'system',
      senderName: currentUserName || 'You',
      content: chatDraft.trim(),
      createdAt: new Date().toISOString(),
    });
    setChatDraft('');
  }

  return (
    <div className="flex h-full flex-col bg-white shadow-[0_0_0_1px_rgba(148,163,184,0.16)]">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-medium text-slate-900">{activeTask.taskName}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{taskStatus}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityClass}`}>{priority}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{category}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            aria-label="Close task details"
          >
            <IconClose />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 border-b border-slate-200">
          {(['overview', 'submission', 'chat'] as DetailTab[]).map((tab) => {
            const enabled = tab !== 'submission' || ['SUBMITTED', 'APPROVED', 'REJECTED'].includes(taskStatus);
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                disabled={!enabled}
                onClick={() => onTabChange(tab)}
                className={`border-b-2 px-3 py-2 text-sm font-medium transition ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'} ${!enabled ? 'cursor-not-allowed opacity-40' : 'hover:text-slate-900'}`}
              >
                {tab === 'overview' ? 'Overview' : tab === 'submission' ? 'Submission' : 'Chat'}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {activeTab === 'overview' && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">ASSIGNMENT INFO</p>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {initials(task.assignedToUser?.name ?? task.assignee)}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Assigned to</p>
                    <p className="text-sm font-medium text-slate-900">{task.assignedToUser?.name ?? task.assignee ?? 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                    {initials(task.assignedByUser?.name ?? 'Manager')}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Assigned by</p>
                    <p className="text-sm font-medium text-slate-900">{task.assignedByUser?.name ?? 'Manager'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Due date</p>
                <div className={`flex items-center gap-2 text-sm ${pastDue ? 'font-medium text-red-600' : 'text-slate-700'}`}>
                  <IconCalendar />
                  <span>{task.dueDate ? `${formatDate(task.dueDate)}${pastDue ? ' !' : ''}` : 'No due date'}</span>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Created</p>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <IconClock />
                  <span>{formatDate(task.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-200" />

            <div className="mt-4 space-y-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">INSTRUCTIONS</p>
              <div className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {task.description?.trim() ? task.description : 'No instructions provided.'}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">REFERENCE LINKS</p>
              {referenceLinks.length === 0 ? (
                <p className="text-sm text-slate-500">No reference links.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {referenceLinks.map((link) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <IconExternalLink />
                      <span className="max-w-56 truncate">{link}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="my-4 h-px bg-slate-200" />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">YOUR ACTION</p>

              {showEmployeeStart && (
                <button
                  type="button"
                  onClick={() => onStartTask(activeTask.id)}
                  disabled={busy}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  Start task
                </button>
              )}

              {showEmployeeSubmit && !showSubmitForm && (
                <button
                  type="button"
                  onClick={() => setShowSubmitForm(true)}
                  disabled={busy}
                  className={`w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50 ${taskStatus === 'REJECTED' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {taskStatus === 'REJECTED' ? 'Resubmit' : 'Submit work'}
                </button>
              )}

              {showEmployeeSubmit && showSubmitForm && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <textarea
                    value={submissionNote}
                    onChange={(e) => setSubmissionNote(e.target.value)}
                    rows={4}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="What did you complete?"
                  />
                  <input
                    value={submissionLink}
                    onChange={(e) => setSubmissionLink(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Link to your work (optional)"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSubmitForm()}
                      disabled={busy || !submissionNote.trim()}
                      className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                    >
                      Submit for review
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSubmitForm(false)}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {showAwaitingReview && (
                <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
                  Awaiting review
                </div>
              )}

              {showApproved && (
                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                  Approved ✓
                </div>
              )}

              {canReview && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">Review submission</p>
                  <textarea
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Add feedback for the employee..."
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleReviewAction('APPROVED')}
                      disabled={busy}
                      className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReviewAction('REJECTED')}
                      disabled={busy}
                      className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {canChangeStatus && !canReview && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">Update task status</p>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(normalizeTaskStatus(e.target.value))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="SUBMITTED">SUBMITTED</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleStatusChange()}
                      disabled={busy}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'submission' && (
          <div className="space-y-4">
            {!['SUBMITTED', 'APPROVED', 'REJECTED'].includes(taskStatus) ? (
              <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
                No submission yet
              </div>
            ) : (
              <>
                <article className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="border-l-4 border-blue-600 pl-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {activeTask.assignedToUser?.name ?? activeTask.assignee ?? 'Employee'}
                      <span className="ml-2 text-xs font-medium text-slate-500">submitted {formatDateTime(submissionDate)}</span>
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {activeTask.submissionNotes?.trim() ? activeTask.submissionNotes : 'No submission notes provided.'}
                    </p>
                    {activeTask.submissionLink && (
                      <a
                        href={activeTask.submissionLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-50"
                      >
                        <IconExternalLink />
                        View submitted work
                      </a>
                    )}
                  </div>
                </article>

                {['APPROVED', 'REJECTED'].includes(taskStatus) && (
                  <article className={`rounded-lg border bg-slate-50 p-4 ${taskStatus === 'APPROVED' ? 'border-green-200' : 'border-red-200'}`}>
                    <div className={`border-l-4 pl-3 ${taskStatus === 'APPROVED' ? 'border-green-600' : 'border-red-600'}`}>
                      <p className="text-sm font-semibold text-slate-900">
                        {activeTask.reviewedByUser?.name ?? 'Reviewer'}
                        <span className="ml-2 text-xs font-medium text-slate-500">reviewed {formatDateTime(activeTask.reviewedAt ?? activeTask.updatedAt)}</span>
                      </p>
                      <div className="mt-3 rounded-lg bg-white p-3 text-sm leading-6 text-slate-700 shadow-sm">
                        {activeTask.reviewComment?.trim() ? activeTask.reviewComment : 'No reviewer remarks provided.'}
                      </div>
                    </div>
                  </article>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex h-full min-h-112 flex-col">
            <div className="mb-4 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              {chatMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No messages yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {chatMessages.map((message) => {
                    const mine = message.senderId === currentUserId;
                    return (
                      <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] ${mine ? 'text-right' : 'text-left'}`}>
                          <div className="mb-1 text-[11px] text-gray-500">
                            {mine ? 'You' : message.senderName} · {formatDateTime(message.createdAt)}
                          </div>
                          <div className={`inline-block rounded-2xl px-4 py-3 text-sm leading-6 ${mine ? 'bg-[#185FA5] text-blue-50' : 'bg-gray-200 text-slate-800'}`}>
                            {message.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex gap-2">
                <input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Write a message"
                />
                <button
                  type="button"
                  onClick={() => void handleSendChat()}
                  disabled={!chatDraft.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AllTasksPage() {
  const [session, setSession] = useState<Session>(readSession);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  const isManagerOrAdmin = session.role === 'ADMIN' || session.role === 'MANAGER';

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
    setSession(readSession());
    void loadTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matchesSearch = (task: Task) => {
      if (!query) return true;

      const haystack = [
        task.taskName,
        task.category,
        task.description,
        task.assignee,
        task.project,
        task.status,
        task.submissionNotes,
        task.reviewComment,
        task.links,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    };

    const scopedTasks = tasks.filter((task) => {
      if (filter === 'mine') {
        return session.currentUserId != null && task.assignedToUserId === session.currentUserId;
      }

      if (filter === 'needs-review') {
        return isManagerOrAdmin ? task.status?.toUpperCase() === 'SUBMITTED' : true;
      }

      return true;
    });

    return scopedTasks.filter(matchesSearch);
  }, [filter, isManagerOrAdmin, search, session.currentUserId, tasks]);

  useEffect(() => {
    if (selectedTaskId != null && !filteredTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
      setActiveTab('overview');
    }
  }, [filteredTasks, selectedTaskId]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  function updateTaskInState(taskId: number, updater: (task: Task) => Task) {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? updater(task) : task)));
  }

  function handleTaskActionError(error: unknown) {
    if (isForbiddenTaskError(error)) {
      console.error('Task update forbidden', error);
      if (typeof window !== 'undefined') {
        window.alert('Could not update task. Please refresh and try again.');
      }
      return true;
    }

    console.error('Task update failed', error);
    return false;
  }

  async function handleStart(taskId: number) {
    setBusy(true);
    try {
      await updateTaskStatus(taskId, 'IN_PROGRESS');
      updateTaskInState(taskId, (task) => ({ ...task, status: 'IN_PROGRESS', updatedAt: new Date().toISOString() }));
      void loadTasks();
    } catch (error) {
      if (!handleTaskActionError(error)) {
        throw error;
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(taskId: number, payload: { submissionLink: string; note: string }) {
    if (!payload.note.trim()) return;
    setBusy(true);
    try {
      await submitTaskWork(taskId, payload);
      updateTaskInState(taskId, (task) => ({
        ...task,
        status: 'SUBMITTED',
        submissionLink: payload.submissionLink || null,
        submissionNotes: payload.note,
        updatedAt: new Date().toISOString(),
      }));
      void loadTasks();
    } catch (error) {
      if (!handleTaskActionError(error)) {
        throw error;
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReview(taskId: number, payload: { status: 'APPROVED' | 'REJECTED'; remarks: string }) {
    setBusy(true);
    try {
      await reviewTask(taskId, payload);
      updateTaskInState(taskId, (task) => ({
        ...task,
        status: payload.status,
        reviewComment: payload.remarks,
        updatedAt: new Date().toISOString(),
      }));
      void loadTasks();
    } catch (error) {
      if (!handleTaskActionError(error)) {
        throw error;
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusUpdate(taskId: number, status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED') {
    setBusy(true);
    try {
      await updateTaskStatus(taskId, status);
      updateTaskInState(taskId, (task) => ({ ...task, status, updatedAt: new Date().toISOString() }));
      void loadTasks();
    } catch (error) {
      if (!handleTaskActionError(error)) {
        throw error;
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Loading…</div>;
  }

  const filters: Array<{ id: TaskFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'mine', label: 'Mine' },
    ...(isManagerOrAdmin ? [{ id: 'needs-review' as const, label: 'Needs review' }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
            <p className="mt-1 text-sm text-slate-500">Split-pane task workspace for review, execution, and follow-up.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-72">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              type="button"
              onClick={() => void loadTasks()}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mb-4 flex items-center gap-4 border-b border-slate-200 pb-4">
          {filters.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`border-b-2 px-1 py-2 text-sm font-medium transition ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-slate-800'}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {filteredTasks.length === 0 ? (
          <div className="flex min-h-112 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
            <div>
              <div className="text-4xl">📋</div>
              <p className="mt-3 text-sm text-slate-500">No tasks here</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                selected={task.id === selectedTaskId}
                onSelect={() => {
                  setSelectedTaskId(task.id);
                  setActiveTab('overview');
                }}
              />
            ))}
          </div>
        )}

        <TaskDetailPanel
          key={selectedTask?.id ?? 'none'}
          task={selectedTask}
          role={session.role}
          currentUserId={session.currentUserId}
          currentUserName={session.currentUserName}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={() => {
            setSelectedTaskId(null);
            setActiveTab('overview');
          }}
          onStartTask={handleStart}
          onSubmitTask={handleSubmit}
          onReviewTask={handleReview}
          onUpdateStatus={handleStatusUpdate}
          busy={busy}
        />
      </div>
    </div>
  );
}
