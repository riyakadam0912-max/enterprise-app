'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getTasks,
  reviewTask,
  submitTaskWork,
  Task,
  updateTaskStatus,
} from '@/api/tasksApi';
import { useStableNow } from '@/hooks/useStableNow';
import { Button } from '@/components/ui/button';
import { toast } from '@/providers/toast-provider';
import { cn } from '@/lib/cn';
import { useAuthSession, type AuthRole } from '@/stores/auth-store';
import { useAuth } from '@/providers/AuthProvider';

type DashboardRole = AuthRole;
type TaskFilter = 'all' | 'mine' | 'needs-review';
type DetailTab = 'overview' | 'submission' | 'chat';
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

type ChatMessage = {
  id: string;
  senderName: string;
  senderId: number | 'system';
  content: string;
  createdAt: string;
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700 border border-slate-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border border-blue-200',
  SUBMITTED: 'bg-amber-50 text-amber-700 border border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border border-rose-200',
};

const PRIORITY_BADGE: Record<string, string> = {
  HIGH: 'bg-rose-50 text-rose-700 border border-rose-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border border-amber-200',
  LOW: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

function formatDate(value?: string | null) {
  if (!value) return 'No due date';
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
  const normalized = status?.trim().toUpperCase();
  switch (normalized) {
    case 'IN_PROGRESS':
    case 'SUBMITTED':
    case 'APPROVED':
    case 'REJECTED':
      return normalized as TaskStatus;
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
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconProject() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v18H3z" />
      <path d="M9 3v18" />
      <path d="M3 9h18" />
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
  onSelect,
}: {
  task: Task;
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
      className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md hover:shadow-blue-100/50"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1.5">
          <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-blue-700">
            {task.taskName}
          </h3>
          {pastDue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Overdue
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-600">
          {task.project && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 border border-slate-200">
              <IconProject />
              <span className="truncate max-w-[120px]">{task.project}</span>
            </span>
          )}
          
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 border border-slate-200">
            <IconUser />
            <span className="truncate max-w-[120px]">{task.assignedToUser?.name ?? task.assignee ?? 'Unassigned'}</span>
          </span>
          
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 border border-slate-200">
            <IconCalendar />
            <span>{formatDate(task.dueDate)}</span>
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2.5 shrink-0">
        <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.LOW)}>
          {priority}
        </span>
        <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', STATUS_BADGE[status] ?? STATUS_BADGE.PENDING)}>
          {status.replace('_', ' ')}
        </span>
      </div>
    </button>
  );
}

function TaskDetailModal({
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
  const [isOpen, setIsOpen] = useState(false);
  const currentTime = useStableNow();

  useEffect(() => {
    if (task) {
      setIsOpen(true);
      setShowSubmitForm(false);
      setSubmissionNote('');
      setSubmissionLink('');
      setReviewRemarks('');
      setStatusDraft(normalizeTaskStatus(task.status));
    } else {
      setIsOpen(false);
    }
  }, [task?.id]);

  const taskStatus = normalizeTaskStatus(task?.status);
  const isEmployee = role === 'EMPLOYEE';
  const isManagerOrAdmin = role === 'ADMIN' || role === 'MANAGER';
  const isAssignee = Boolean(
    task && 
    currentUserId != null && 
    Number(task.assignedToUserId) === Number(currentUserId)
  );
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
        window.clearTimeout(chatIntervalRef.current);
        chatIntervalRef.current = null;
      }
      return undefined;
    }

    if (chatIntervalRef.current) {
      window.clearTimeout(chatIntervalRef.current);
    }

    chatIntervalRef.current = window.setTimeout(() => {
      setChatMessagesByTask((prev) => ({ ...prev }));
    }, 10000);

    return () => {
      if (chatIntervalRef.current) {
        window.clearTimeout(chatIntervalRef.current);
        chatIntervalRef.current = null;
      }
    };
  }, [activeTab, task]);

  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current && isOpen) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, chatMessages, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!task || !isOpen) {
    return null;
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

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="border-b border-slate-200 px-7 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold text-slate-900">{activeTask.taskName}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', statusClass)}>
                    {taskStatus.replace('_', ' ')}
                  </span>
                  <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', priorityClass)}>
                    {priority}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                    {category}
                  </span>
                  {pastDue && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      Overdue
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full border border-slate-200 hover:bg-slate-100"
                aria-label="Close task details"
              >
                <IconClose />
              </Button>
            </div>

            <div className="mt-5 flex items-center gap-2 border-b border-slate-200">
              {(['overview', 'submission', 'chat'] as DetailTab[]).map((tab) => {
                const enabled = tab !== 'submission' || ['SUBMITTED', 'APPROVED', 'REJECTED'].includes(taskStatus);
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    disabled={!enabled}
                    onClick={() => onTabChange(tab)}
                    className={cn(
                      'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                      active
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-slate-500 hover:text-slate-900',
                      !enabled && 'cursor-not-allowed opacity-40'
                    )}
                  >
                    {tab === 'overview' ? 'Overview' : tab === 'submission' ? 'Submission' : 'Chat'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-7 py-5">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Assignment Info</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                          {initials(task.assignedToUser?.name ?? task.assignee)}
                        </div>
                        <div>
                          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">Assigned to</p>
                          <p className="text-sm font-medium text-slate-900">{task.assignedToUser?.name ?? task.assignee ?? 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                          {initials(task.assignedByUser?.name ?? 'Manager')}
                        </div>
                        <div>
                          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">Assigned by</p>
                          <p className="text-sm font-medium text-slate-900">{task.assignedByUser?.name ?? 'Manager'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">Due date</p>
                      <div className={cn('flex items-center gap-2 text-sm', pastDue ? 'font-medium text-rose-600' : 'text-slate-700')}>
                        <IconCalendar />
                        <span>{formatDate(task.dueDate)}</span>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">Project</p>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <IconProject />
                        <span>{task.project ?? 'No project'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-200" />

                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Instructions</p>
                  <div className="rounded-2xl bg-slate-50 p-5 text-sm leading-relaxed text-slate-700 border border-slate-200">
                    {task.description?.trim() ? task.description : 'No instructions provided.'}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reference Links</p>
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
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
                        >
                          <IconExternalLink />
                          <span className="max-w-64 truncate">{link}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-px bg-slate-200" />

                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</p>
                  {/* Debug Info */}
                  <div className="mb-4 p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-mono">
                    <p><strong>role:</strong> {role}</p>
                    <p><strong>currentUserId:</strong> {currentUserId}</p>
                    <p><strong>task.assignedToUserId:</strong> {task.assignedToUserId}</p>
                    <p><strong>task.status:</strong> {task.status}</p>
                    <p><strong>isAssignee:</strong> {String(isAssignee)}</p>
                    <p><strong>canEmployeeAct:</strong> {String(canEmployeeAct)}</p>
                    <p><strong>showEmployeeStart:</strong> {String(showEmployeeStart)}</p>
                    <p><strong>showEmployeeSubmit:</strong> {String(showEmployeeSubmit)}</p>
                  </div>
                  <div className="space-y-3">
                    {showEmployeeStart && (
                      <Button
                        onClick={() => onStartTask(activeTask.id)}
                        disabled={busy}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        Start Task
                      </Button>
                    )}

                    {showEmployeeSubmit && !showSubmitForm && (
                      <Button
                        onClick={() => setShowSubmitForm(true)}
                        disabled={busy}
                        className={cn('w-full', taskStatus === 'REJECTED' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700')}
                      >
                        {taskStatus === 'REJECTED' ? 'Resubmit Work' : 'Submit Work'}
                      </Button>
                    )}

                    {showEmployeeSubmit && showSubmitForm && (
                      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <textarea
                          value={submissionNote}
                          onChange={(e) => setSubmissionNote(e.target.value)}
                          rows={4}
                          required
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          placeholder="What did you complete?"
                        />
                        <input
                          value={submissionLink}
                          onChange={(e) => setSubmissionLink(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          placeholder="Link to your work (optional)"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => void handleSubmitForm()}
                            disabled={busy || !submissionNote.trim()}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                          >
                            Submit for Review
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowSubmitForm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {showAwaitingReview && (
                      <div className="rounded-2xl bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800 border border-amber-200">
                        Awaiting review
                      </div>
                    )}

                    {showApproved && (
                      <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 border border-emerald-200">
                        Approved ✓
                      </div>
                    )}

                    {canReview && (
                      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-sm font-medium text-slate-900">Review submission</p>
                        <textarea
                          value={reviewRemarks}
                          onChange={(e) => setReviewRemarks(e.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          placeholder="Add feedback for the employee..."
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => void handleReviewAction('APPROVED')}
                            disabled={busy}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                          >
                            Approve
                          </Button>
                          <Button
                            onClick={() => void handleReviewAction('REJECTED')}
                            disabled={busy}
                            variant="destructive"
                            className="flex-1"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {canChangeStatus && !canReview && (
                      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-sm font-medium text-slate-900">Update task status</p>
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                          <select
                            value={statusDraft}
                            onChange={(e) => setStatusDraft(normalizeTaskStatus(e.target.value))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="IN_PROGRESS">IN PROGRESS</option>
                            <option value="SUBMITTED">SUBMITTED</option>
                            <option value="APPROVED">APPROVED</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                          <Button
                            onClick={() => void handleStatusChange()}
                            disabled={busy}
                          >
                            Update
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'submission' && (
              <div className="space-y-5">
                {!['SUBMITTED', 'APPROVED', 'REJECTED'].includes(taskStatus) ? (
                  <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
                    No submission yet
                  </div>
                ) : (
                  <>
                    <article className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
                      <div className="border-l-4 border-blue-600 pl-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {activeTask.assignedToUser?.name ?? activeTask.assignee ?? 'Employee'}
                          <span className="ml-2 text-xs font-medium text-slate-500">submitted {formatDateTime(submissionDate)}</span>
                        </p>
                        <p className="mt-4 text-sm leading-relaxed text-slate-700">
                          {activeTask.submissionNotes?.trim() ? activeTask.submissionNotes : 'No submission notes provided.'}
                        </p>
                        {activeTask.submissionLink && (
                          <a
                            href={activeTask.submissionLink}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-100 border border-blue-200"
                          >
                            <IconExternalLink />
                            View submitted work
                          </a>
                        )}
                      </div>
                    </article>

                    {['APPROVED', 'REJECTED'].includes(taskStatus) && (
                      <article className={cn('rounded-2xl border bg-slate-50 p-6', taskStatus === 'APPROVED' ? 'border-emerald-200' : 'border-rose-200')}>
                        <div className={cn('border-l-4 pl-4', taskStatus === 'APPROVED' ? 'border-emerald-600' : 'border-rose-600')}>
                          <p className="text-sm font-semibold text-slate-900">
                            {activeTask.reviewedByUser?.name ?? 'Reviewer'}
                            <span className="ml-2 text-xs font-medium text-slate-500">reviewed {formatDateTime(activeTask.reviewedAt ?? activeTask.updatedAt)}</span>
                          </p>
                          <div className="mt-4 rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm border border-slate-200">
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
              <div className="flex h-[500px] flex-col">
                <div className="mb-4 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  {chatMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {chatMessages.map((message) => {
                        const mine = message.senderId === currentUserId;
                        return (
                          <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] ${mine ? 'text-right' : 'text-left'}`}>
                              <div className="mb-1 text-[11px] text-slate-500">
                                {mine ? 'You' : message.senderName} · {formatDateTime(message.createdAt)}
                              </div>
                              <div className={cn(
                                'inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed',
                                mine ? 'bg-blue-600 text-white' : 'bg-white text-slate-800 border border-slate-200'
                              )}>
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
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="Write a message..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendChat();
                        }
                      }}
                    />
                    <Button
                      onClick={() => void handleSendChat()}
                      disabled={!chatDraft.trim()}
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AllTasksPage() {
  const authSession = useAuthSession();
  const { session } = useAuth();
  
  const role = authSession.role;
  const currentUserId = authSession.user?.id ?? null;
  const currentUserName = authSession.user?.name ?? '';
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  const isManagerOrAdmin = role === 'ADMIN' || role === 'MANAGER';

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
        return currentUserId != null && task.assignedToUserId === currentUserId;
      }

      if (filter === 'needs-review') {
        return isManagerOrAdmin ? task.status?.toUpperCase() === 'SUBMITTED' : true;
      }

      return true;
    });

    return scopedTasks.filter(matchesSearch);
  }, [filter, isManagerOrAdmin, search, currentUserId, tasks]);

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
      toast.error('Permission denied', 'Could not update task. Please refresh and try again.');
      return true;
    }

    console.error('Task update failed', error);
    toast.error('Action failed', 'Something went wrong. Please try again.');
    return false;
  }

  async function handleStart(taskId: number) {
    setBusy(true);
    try {
      await updateTaskStatus(taskId, 'IN_PROGRESS');
      updateTaskInState(taskId, (task) => ({ ...task, status: 'IN_PROGRESS', updatedAt: new Date().toISOString() }));
      toast.success('Task started', 'Task status updated to IN PROGRESS');
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
      toast.success('Work submitted', 'Task has been submitted for review');
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
    console.log('[handleReview] Received payload:', payload);
    setBusy(true);
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      const currentStatus = normalizeTaskStatus(task.status);
      console.log('[handleReview] Current task status:', currentStatus);
      console.log('[handleReview] Requested decision:', payload.status);
      
      if (currentStatus === 'APPROVED' || currentStatus === 'REJECTED') {
        console.log('[handleReview] Task is already reviewed - skipping API request');
        return;
      }
      
      if (currentStatus !== 'SUBMITTED') {
        console.log('[handleReview] Task status is not SUBMITTED - cannot review');
        return;
      }
      
      await reviewTask(taskId, payload);
      updateTaskInState(taskId, (task) => ({
        ...task,
        status: payload.status,
        reviewComment: payload.remarks,
        updatedAt: new Date().toISOString(),
      }));
      toast.success(
        payload.status === 'APPROVED' ? 'Task approved' : 'Task rejected',
        payload.status === 'APPROVED' ? 'Great work!' : 'Please review the feedback'
      );
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
      toast.success('Status updated', `Task status changed to ${status.replace('_', ' ')}`);
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
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          Loading tasks…
        </div>
      </div>
    );
  }

  const filters: Array<{ id: TaskFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'mine', label: 'Mine' },
    ...(isManagerOrAdmin ? [{ id: 'needs-review' as const, label: 'Needs Review' }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
            <p className="mt-1 text-sm text-slate-500">Manage and track your team&apos;s tasks efficiently.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="w-full sm:w-80">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => void loadTasks()}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mb-5 flex items-center gap-2 border-b border-slate-200 pb-4">
          {filters.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {filteredTasks.length === 0 ? (
          <div className="flex min-h-80 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
            <div>
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No tasks here</h3>
              <p className="text-sm text-slate-500">Create a new task or adjust filters to see existing tasks.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onSelect={() => {
                  setSelectedTaskId(task.id);
                  setActiveTab('overview');
                }}
              />
            ))}
          </div>
        )}

        <TaskDetailModal
          key={selectedTask?.id ?? 'none'}
          task={selectedTask}
          role={role}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
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
