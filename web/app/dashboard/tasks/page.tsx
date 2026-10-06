'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getTasks,
  getTaskMessages,
  reviewTask,
  sendTaskMessage,
  submitTaskWork,
  Task,
  updateTask,
  updateTaskStatus,
  deleteTask,
} from '@/api/tasksApi';
import { useStableNow } from '@/hooks/useStableNow';
import { Button } from '@/components/ui/button';
import { toast } from '@/providers/toast-provider';
import { cn } from '@/lib/cn';
import { useAuthSession, type AuthRole } from '@/stores/auth-store';
import { useAuth } from '@/providers/AuthProvider';
import { SuccessFeedback } from '@/components/feedback/SuccessFeedback';
import { TaskTimerSessionsCell } from '@/components/tasks/TaskTimerSessionsCell';
import CreateTaskDrawer from '@/components/tasks/CreateTaskDrawer';
import { TaskDetailHeader, TaskDetailMetadata } from '@/components/tasks/TaskDetailPresentation';
import { dateTimeLocalToIso, toDateTimeLocalValue } from '@/utils/dateUtils';
import { Check, ClipboardList, ExternalLink, FileText, MessageCircle, Play, Send, X } from 'lucide-react';

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

type TaskGridColumnKey = 'id' | 'task' | 'organization' | 'project' | 'assignee' | 'status' | 'priority' | 'dueDate' | 'estimatedHours' | 'actualHours' | 'timer';

const TASK_GRID_COLUMNS: Array<{ key: TaskGridColumnKey; label: string }> = [
  { key: 'id', label: 'ID' },
  { key: 'task', label: 'Task' },
  { key: 'organization', label: 'Organization' },
  { key: 'project', label: 'Project' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'estimatedHours', label: 'Estimated Hours' },
  { key: 'actualHours', label: 'Actual Hours' },
  { key: 'timer', label: 'Timer' },
];

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700 border border-slate-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border border-blue-200',
  SUBMITTED: 'bg-amber-50 text-amber-700 border border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border border-rose-200',
};

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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-slate-400">
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16L21 21" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M4 6H20" strokeLinecap="round" />
      <path d="M7 12H17" strokeLinecap="round" />
      <path d="M10 18H14" strokeLinecap="round" />
    </svg>
  );
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

function IconExternalLink() {
  return <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
}

function isForbiddenTaskError(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'status' in error
    && (error as { status?: number }).status === 403,
  );
}

function TaskDetailModal({
  task,
  role,
  currentUserId,
  activeTab,
  onTabChange,
  onClose,
  onStartTask,
  onSubmitTask,
  onReviewTask,
  onEditTask,
  onUpdateStatus,
  onLoadMessages,
  onSendMessage,
  busy,
}: {
  task: Task | null;
  role: DashboardRole;
  currentUserId: number | null;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
  onStartTask: (taskId: number) => Promise<void>;
  onSubmitTask: (taskId: number, payload: { submissionLink: string; note: string }) => Promise<void>;
  onReviewTask: (taskId: number, payload: { status: 'APPROVED' | 'REJECTED'; remarks: string }) => Promise<void>;
  onEditTask: (taskId: number, payload: {
    taskName: string;
    category: string;
    description: string;
    links: string;
    driveLink: string;
    priority: string;
    estimatedHours: number | null;
    dueDate: string | null;
  }) => Promise<void>;
  onUpdateStatus: (taskId: number, status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED') => Promise<void>;
  onLoadMessages: (taskId: number) => Promise<ChatMessage[]>;
  onSendMessage: (taskId: number, content: string) => Promise<ChatMessage>;
  busy: boolean;
}) {
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [statusDraft, setStatusDraft] = useState<TaskStatus>(normalizeTaskStatus(task?.status));
  const [showEditForm, setShowEditForm] = useState(false);
  const [editTaskName, setEditTaskName] = useState(task?.taskName ?? '');
  const [editCategory, setEditCategory] = useState(task?.category ?? '');
  const [editDescription, setEditDescription] = useState(task?.description ?? '');
  const [editLinks, setEditLinks] = useState(task?.links ?? '');
  const [editDriveLink, setEditDriveLink] = useState(task?.driveLink ?? '');
  const [editPriority, setEditPriority] = useState(task?.priority ?? 'MEDIUM');
  const [editEstimatedHours, setEditEstimatedHours] = useState(task?.estimatedHours?.toString() ?? '');
  const [editDueDate, setEditDueDate] = useState(toDateTimeLocalValue(task?.dueDate));
  const [chatDraft, setChatDraft] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatIntervalRef = useRef<number | null>(null);
  const currentTime = useStableNow();

  // Derive modal open state from task existence
  const isOpen = Boolean(task);

  // Reset form state when task changes
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setShowSubmitForm(false);
      setSubmissionNote('');
      setSubmissionLink('');
      setReviewRemarks('');
      setStatusDraft(normalizeTaskStatus(task?.status));
      setChatMessages([]);
      setChatError('');
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [task?.id, task?.status]);

  const taskStatus = normalizeTaskStatus(task?.status);
  const activeTaskId = task?.id;

  useEffect(() => {
    if (activeTab !== 'chat' || activeTaskId == null) return;
    let cancelled = false;
    const loadMessages = async (showLoading: boolean) => {
      if (showLoading) setChatLoading(true);
      try {
        const messages = await onLoadMessages(activeTaskId);
        if (!cancelled) {
          setChatMessages(messages);
          setChatError('');
        }
      } catch (error) {
        if (!cancelled) setChatError(error instanceof Error ? error.message : 'Unable to load task messages.');
      } finally {
        if (!cancelled) {
          setChatLoading(false);
          chatIntervalRef.current = window.setTimeout(() => void loadMessages(false), 5000);
        }
      }
    };
    void loadMessages(true);
    return () => {
      cancelled = true;
      if (chatIntervalRef.current) {
        window.clearTimeout(chatIntervalRef.current);
        chatIntervalRef.current = null;
      }
    };
  }, [activeTab, activeTaskId, onLoadMessages]);

  useEffect(() => {
    return () => {
      if (chatIntervalRef.current) {
        window.clearTimeout(chatIntervalRef.current);
        chatIntervalRef.current = null;
      }
    };
  }, []);

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

  const priority = activeTask.priority?.toUpperCase() ?? 'LOW';
  const category = activeTask.category?.trim() || 'Other';
  const pastDue = isOverdue(activeTask, currentTime);
  const referenceLinks = parseLinks(activeTask.links ?? null);
  const isAssignee = currentUserId != null && activeTask.assignedToUserId != null && currentUserId === activeTask.assignedToUserId;
  const showEmployeeStart = isAssignee && taskStatus === 'PENDING';
  const showEmployeeSubmit = isAssignee && ['IN_PROGRESS', 'REJECTED'].includes(taskStatus);
  const showAwaitingReview = taskStatus === 'SUBMITTED' && !isAssignee;
  const showApproved = taskStatus === 'APPROVED';
  const isManagerOrAdmin = role === 'ADMIN' || role === 'MANAGER';
  const canReview = (role === 'ADMIN' || role === 'MANAGER') && taskStatus === 'SUBMITTED';
  const canChangeStatus = role === 'ADMIN' || role === 'MANAGER';
  const submissionDate = activeTask.updatedAt ?? activeTask.createdAt;

  async function handleSubmitForm() {
    if (!submissionNote.trim()) return;
    await onSubmitTask(activeTask.id, {
      note: submissionNote.trim(),
      submissionLink: submissionLink.trim(),
    });
    setShowSubmitForm(false);
    setSubmissionNote('');
    setSubmissionLink('');
  }

  async function handleReviewAction(status: 'APPROVED' | 'REJECTED') {
    await onReviewTask(activeTask.id, { status, remarks: reviewRemarks.trim() });
    setReviewRemarks('');
    setShowReviewForm(false);
  }

  async function handleStatusChange() {
    await onUpdateStatus(activeTask.id, statusDraft);
  }

  async function handleEditSave() {
    if (!editTaskName.trim()) return;
    await onEditTask(activeTask.id, {
      taskName: editTaskName.trim(),
      category: editCategory.trim(),
      description: editDescription,
      links: editLinks,
      driveLink: editDriveLink.trim(),
      priority: editPriority,
      estimatedHours: editEstimatedHours ? Number(editEstimatedHours) : null,
      dueDate: dateTimeLocalToIso(editDueDate),
    });
    setShowEditForm(false);
  }

  async function handleSendChat() {
    if (!chatDraft.trim()) return;
    try {
      const message = await onSendMessage(activeTask.id, chatDraft.trim());
      setChatMessages((previous) => [...previous, message]);
      setChatDraft('');
      setChatError('');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Unable to send task message.');
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
        <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div>
            <TaskDetailHeader
              taskId={activeTask.id}
              taskName={activeTask.taskName}
              status={taskStatus}
              priority={priority}
              category={category}
              overdue={pastDue}
              editing={showEditForm}
              onEdit={isManagerOrAdmin ? () => {
                onTabChange('overview');
                setShowEditForm((current) => !current);
              } : undefined}
              onClose={onClose}
            />
            <div className="px-5 sm:px-7">
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
                      'border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4',
                      active
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-slate-500 hover:text-slate-900',
                      !enabled && 'cursor-not-allowed opacity-40'
                    )}
                  >
                    {tab === 'overview' ? <ClipboardList className="mr-1.5 inline h-4 w-4" /> : tab === 'submission' ? <FileText className="mr-1.5 inline h-4 w-4" /> : <MessageCircle className="mr-1.5 inline h-4 w-4" />}
                    {tab === 'overview' ? 'Overview' : tab === 'submission' ? 'Submission' : 'Chat'}
                  </button>
                );
              })}
            </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <TaskDetailMetadata
                  assigneeId={task.assignedToUser?.id}
                  assigneeName={task.assignedToUser?.name ?? task.assignee}
                  assigneeEmail={task.assignedToUser?.email}
                  assignerName={task.assignedByUser?.name}
                  dueDate={task.dueDate}
                  project={task.project}
                  estimatedHours={task.estimatedHours}
                  createdAt={task.createdAt}
                  overdue={pastDue}
                />

                <div className="h-px bg-slate-200" />

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-900">Instructions</p>
                  <div className="whitespace-pre-wrap wrap-break-word text-sm leading-6 text-slate-600">
                    {task.description?.trim() ? task.description : 'No instructions provided.'}
                  </div>
                </div>

                {isManagerOrAdmin && showEditForm && (
                  <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
                    <p className="text-sm font-semibold text-slate-900">Edit task details</p>
                    <input value={editTaskName} onChange={(e) => setEditTaskName(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Task title" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Category" />
                      <input type="number" min="0.01" step="0.25" value={editEstimatedHours} onChange={(e) => setEditEstimatedHours(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Estimate in hours" />
                      <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                      </select>
                    </div>
                    <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Description and instructions" />
                    <input value={editLinks} onChange={(e) => setEditLinks(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Reference links, comma separated" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input type="url" value={editDriveLink} onChange={(e) => setEditDriveLink(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Google Drive link" />
                      <label className="text-xs text-slate-500">Deadline date and time (your local timezone)</label>
                      <input type="datetime-local" aria-label="Deadline date and time" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => void handleEditSave()} disabled={busy || !editTaskName.trim()}><Check className="mr-2 h-4 w-4" />Save changes</Button>
                      <Button variant="outline" onClick={() => setShowEditForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

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
                          <span className="max-w-64 truncate">Reference URL: {link}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {task.driveLink && (
                    <a
                      href={task.driveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <IconExternalLink />
                      Google Drive
                    </a>
                  )}
                </div>

                <div className="h-px bg-slate-200" />

                <div>
                  <p className="mb-3 text-sm font-semibold text-slate-900">Actions</p>
                  <div className="space-y-3">
                    {showEmployeeStart && (
                      <Button
                        onClick={() => onStartTask(activeTask.id)}
                        disabled={busy}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                            <Play className="mr-2 h-4 w-4" />Start Task
                      </Button>
                    )}

                    {showEmployeeSubmit && !showSubmitForm && (
                      <Button
                        onClick={() => setShowSubmitForm(true)}
                        disabled={busy}
                        className={cn('w-full', taskStatus === 'REJECTED' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700')}
                      >
                        <Send className="mr-2 h-4 w-4" />{taskStatus === 'REJECTED' ? 'Resubmit Work' : 'Submit Work'}
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
                            <Send className="mr-2 h-4 w-4" />Submit for Review
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
                      <SuccessFeedback
                        title="Task approved successfully"
                        description="This task has passed review."
                      />
                    )}

                    {canReview && !showReviewForm && (
                      <Button onClick={() => setShowReviewForm(true)} className="bg-slate-900 text-white hover:bg-slate-800">
                        <Check className="mr-2 h-4 w-4" />Review submission
                      </Button>
                    )}

                    {canReview && showReviewForm && (
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
                            <Check className="mr-2 h-4 w-4" />Approve
                          </Button>
                          <Button
                            onClick={() => void handleReviewAction('REJECTED')}
                            disabled={busy}
                            className="flex-1 bg-rose-700 text-white hover:bg-rose-800"
                          >
                            <X className="mr-2 h-4 w-4" />Reject
                          </Button>
                        </div>
                        <Button variant="outline" onClick={() => setShowReviewForm(false)}>Cancel</Button>
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
                            <Check className="mr-2 h-4 w-4" />Update
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
              <div className="flex h-125 flex-col">
                <div className="mb-4 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  {chatLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading messages...</div>
                  ) : chatMessages.length === 0 ? (
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

                {chatError && <p className="mb-3 text-sm text-rose-600">{chatError}</p>}

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
                            <Send className="mr-2 h-4 w-4" />Send
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
  const { session: _session } = useAuth();
  
  const role = authSession.role;
  const currentUserId = authSession.user?.id ?? null;
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [isTaskFilterOpen, setIsTaskFilterOpen] = useState(false);
  const [visibleTaskColumns, setVisibleTaskColumns] = useState<Record<string, boolean>>(() => Object.fromEntries(TASK_GRID_COLUMNS.map((column) => [column.key, true])));

  const isManagerOrAdmin = role === 'ADMIN' || role === 'MANAGER';
  const visibleTaskColumnList = useMemo(
    () => TASK_GRID_COLUMNS.filter((column) => visibleTaskColumns[column.key] !== false),
    [visibleTaskColumns],
  );

  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err: unknown) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
        setTasks([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadTasks(true);
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matchesSearch = (task: Task) => {
      if (!query) return true;

      const haystack = [
        task.taskName,
        task.category,
        task.description,
        task.assignee,
        task.organization?.name,
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

  function toggleTaskSelection(taskId: number) {
    setSelectedTaskIds((current) => current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]);
  }

  function exportSelectedTasks() {
    const rows = filteredTasks.filter((task) => selectedTaskIds.includes(task.id));
    const csv = ['ID,Task,Organization,Project,Assignee,Status,Priority,Due Date', ...rows.map((task) => [task.id, task.taskName, task.organization?.name ?? '', task.project ?? '', task.assignedToUser?.name ?? task.assignee ?? '', task.status, task.priority ?? '', task.dueDate ?? ''].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'tasks.csv'; anchor.click(); URL.revokeObjectURL(url);
  }

  async function deleteSelectedTasks() {
    if (selectedTaskIds.length === 0 || !window.confirm(`Delete ${selectedTaskIds.length} selected task(s)?`)) return;
    await Promise.all(selectedTaskIds.map((id) => deleteTask(id)));
    setTasks((current) => current.filter((task) => !selectedTaskIds.includes(task.id)));
    setSelectedTaskIds([]);
  }

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
    setBusy(true);
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      const currentStatus = normalizeTaskStatus(task.status);
      
      if (currentStatus === 'APPROVED' || currentStatus === 'REJECTED') {
        return;
      }
      
      if (currentStatus !== 'SUBMITTED') {
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

  async function handleEditTask(taskId: number, payload: {
    taskName: string;
    category: string;
    description: string;
    links: string;
    driveLink: string;
    priority: string;
    estimatedHours: number | null;
    dueDate: string | null;
  }) {
    setBusy(true);
    try {
      const updated = await updateTask(taskId, {
        ...payload,
        driveLink: payload.driveLink || undefined,
      });
      updateTaskInState(taskId, (task) => ({ ...task, ...updated }));
      toast.success('Task updated', 'Task details saved successfully');
      void loadTasks();
    } catch (error) {
      if (!handleTaskActionError(error)) throw error;
    } finally {
      setBusy(false);
    }
  }

  const loadTaskMessages = useCallback(async (taskId: number): Promise<ChatMessage[]> => {
    const messages = await getTaskMessages(taskId);
    return messages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      senderName: message.sender.name,
      content: message.content,
      createdAt: message.createdAt,
    }));
  }, []);

  const sendTaskChatMessage = useCallback(async (taskId: number, content: string): Promise<ChatMessage> => {
    const message = await sendTaskMessage(taskId, content);
    return {
      id: message.id,
      senderId: message.senderId,
      senderName: message.sender.name,
      content: message.content,
      createdAt: message.createdAt,
    };
  }, []);

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

  const currentFilterLabel = filters.find((filterOption) => filterOption.id === filter)?.label ?? 'All';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-6 py-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-[2.3rem] font-semibold tracking-tight text-slate-900">Tasks Workflow</h1>
            <p className="mt-2 text-sm text-slate-500">Create Task → Assign Employee → Review Work → Track Progress</p>
          </div>

          {['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(role) && (
            <button
              type="button"
              onClick={() => setShowCreateTask(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              <span className="text-xl leading-none">+</span>
              <span>Create Task</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="px-6 py-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Spreadsheet view</p>
              {selectedTaskIds.length > 0 && <span className="text-xs font-semibold text-orange-600">{selectedTaskIds.length} selected</span>}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tasks"
                  aria-label="Search tasks"
                  className="w-52 rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTaskFilterOpen((open) => !open)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                    filter !== 'all' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <FilterIcon />
                  <span>{filter === 'all' ? 'Filter' : currentFilterLabel}</span>
                  {filter !== 'all' && <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">1</span>}
                </button>

                {isTaskFilterOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    {filters.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setFilter(option.id);
                          setIsTaskFilterOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition ${
                          filter === option.id ? 'bg-orange-50 text-orange-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{option.label}</span>
                        {filter === option.id && <span className="text-xs font-semibold">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <details className="group">
                  <summary className="cursor-pointer list-none rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300">
                    Columns
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                    {TASK_GRID_COLUMNS.map((column) => (
                      <label key={column.key} className="flex items-center gap-2 py-1.5 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={visibleTaskColumns[column.key] !== false}
                          onChange={(event) => setVisibleTaskColumns((current) => ({ ...current, [column.key]: event.target.checked }))}
                        />
                        {column.label}
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => setVisibleTaskColumns(Object.fromEntries(TASK_GRID_COLUMNS.map((column) => [column.key, true])))}
                      className="mt-2 w-full border-t border-slate-100 pt-2 text-left text-xs font-semibold text-orange-600"
                    >
                      Reset columns
                    </button>
                  </div>
                </details>
              </div>
            </div>
          </div>

          {selectedTaskIds.length > 0 && (
            <div className="flex items-center gap-2 border-b border-orange-100 bg-orange-50 px-4 py-2">
              <span className="text-xs font-semibold text-orange-700">{selectedTaskIds.length} selected</span>
              <button type="button" onClick={exportSelectedTasks} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Export CSV</button>
              <button type="button" onClick={() => void deleteSelectedTasks()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">Delete</button>
              <button type="button" onClick={() => setSelectedTaskIds([])} className="text-xs font-semibold text-slate-500">Clear</button>
            </div>
          )}

          {filteredTasks.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center px-6 py-12 text-center">
              <div>
                <div className="mb-4 text-5xl">📋</div>
                <h3 className="mb-1 text-lg font-semibold text-slate-900">No tasks here</h3>
                <p className="text-sm text-slate-500">Create a new task or adjust filters to see existing tasks.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-max border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr>
                    <th className="sticky left-0 z-20 border-b border-slate-200 bg-slate-50 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.includes(task.id))}
                        onChange={(event) => setSelectedTaskIds(event.target.checked ? filteredTasks.map((task) => task.id) : [])}
                        aria-label="Select all tasks"
                      />
                    </th>
                    {visibleTaskColumnList.map((column, index) => (
                      <th
                        key={column.key}
                        className={`whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${index < 2 ? 'sticky z-10 bg-slate-50' : ''}`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      tabIndex={0}
                      onClick={() => { setSelectedTaskId(task.id); setActiveTab('overview'); }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          setSelectedTaskId(task.id);
                          setActiveTab('overview');
                        }
                      }}
                      className={`cursor-pointer transition hover:bg-orange-50/50 ${selectedTaskId === task.id ? 'bg-orange-50' : ''}`}
                    >
                      <td className="sticky left-0 z-10 bg-white px-3 py-3" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={() => toggleTaskSelection(task.id)}
                          aria-label={`Select task ${task.taskName}`}
                        />
                      </td>

                      {visibleTaskColumnList.map((column) => {
                        const cellClass = 'whitespace-nowrap px-4 py-3 text-slate-700';

                        if (column.key === 'id') {
                          return <td key={column.key} className={`${cellClass} sticky z-10 bg-white`}>#{task.id}</td>;
                        }

                        if (column.key === 'task') {
                          return <td key={column.key} className={`${cellClass} sticky z-10 bg-white`}><span className="font-semibold text-slate-900">{task.taskName}</span></td>;
                        }

                        if (column.key === 'organization') {
                          return <td key={column.key} className={cellClass}>{task.organization?.name ?? '—'}</td>;
                        }

                        if (column.key === 'project') {
                          return <td key={column.key} className={cellClass}>{task.project ?? '—'}</td>;
                        }

                        if (column.key === 'assignee') {
                          return <td key={column.key} className={cellClass}>{task.assignedToUser?.name ?? task.assignee ?? 'Unassigned'}</td>;
                        }

                        if (column.key === 'status') {
                          return (
                            <td key={column.key} className={cellClass}>
                              <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', STATUS_BADGE[task.status?.toUpperCase()] ?? STATUS_BADGE.PENDING)}>
                                {task.status?.replace('_', ' ')}
                              </span>
                            </td>
                          );
                        }

                        if (column.key === 'priority') {
                          return <td key={column.key} className={cellClass}>{task.priority ?? '—'}</td>;
                        }

                        if (column.key === 'dueDate') {
                          return <td key={column.key} className={cellClass}>{formatDateTime(task.dueDate)}</td>;
                        }

                        if (column.key === 'estimatedHours') {
                          return <td key={column.key} className={cellClass}>{task.estimatedHours ?? '—'}</td>;
                        }

                        if (column.key === 'actualHours') {
                          return <td key={column.key} className={cellClass}>{task.actualHours ?? '—'}</td>;
                        }

                        if (column.key === 'timer') {
                          return (
                            <td key={column.key} className={cellClass} onClick={(event) => event.stopPropagation()}>
                              <TaskTimerSessionsCell
                                taskId={task.id}
                                estimateHours={task.estimatedHours}
                                actualHours={task.actualHours}
                                sessions={task.timerSessions}
                                legacyTimerTotalSeconds={task.legacyTimerTotalSeconds}
                                currentUserId={currentUserId}
                                canControl={role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR' || role === 'MANAGER' || role === 'EMPLOYEE'}
                              />
                            </td>
                          );
                        }

                        return null;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <TaskDetailModal
          key={selectedTask?.id ?? 'none'}
          task={selectedTask}
          role={role}
          currentUserId={currentUserId}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={() => {
            setSelectedTaskId(null);
            setActiveTab('overview');
          }}
          onStartTask={handleStart}
          onSubmitTask={handleSubmit}
          onReviewTask={handleReview}
          onEditTask={handleEditTask}
          onUpdateStatus={handleStatusUpdate}
          onLoadMessages={loadTaskMessages}
          onSendMessage={sendTaskChatMessage}
          busy={busy}
        />
        <CreateTaskDrawer
          open={showCreateTask}
          onClose={() => setShowCreateTask(false)}
          onCreated={async () => {
            setShowCreateTask(false);
            toast.success('Task created', 'The task has been added successfully.');
            await loadTasks(true);
          }}
        />
    </div>
  );
}
