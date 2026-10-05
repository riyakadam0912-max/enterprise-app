'use client';

import { useEffect, useMemo, useState } from 'react';
import { UserIdentity } from '@/components/common/UserIdentity';
import { CalendarDays, Check, Clock3, ExternalLink, Flag, FolderKanban, MessageCircle, Pencil, Play, Send, UserRound, UserRoundCog, X } from 'lucide-react';

type DashboardRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type TaskChatMessage = {
  id: string;
  senderId: number;
  senderName: string;
  content: string;
  createdAt: string;
};

type TaskLike = {
  id: number;
  taskName: string;
  status: string;
  priority?: string | null;
  estimatedHours?: number | null;
  category?: string | null;
  description?: string | null;
  links?: string | null;
  driveLink?: string | null;
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
  onEditTask?: (taskId: number, payload: {
    taskName: string;
    category: string;
    description: string;
    links: string;
    driveLink: string;
    priority: string;
    estimatedHours: number | null;
    dueDate: string | null;
  }) => Promise<void> | void;
  onLoadMessages?: (taskId: number) => Promise<TaskChatMessage[]>;
  onSendMessage?: (taskId: number, content: string) => Promise<TaskChatMessage>;
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
  onEditTask,
  onLoadMessages,
  onSendMessage,
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
      onEditTask={onEditTask}
      onLoadMessages={onLoadMessages}
      onSendMessage={onSendMessage}
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
  onEditTask?: (taskId: number, payload: {
    taskName: string;
    category: string;
    description: string;
    links: string;
    driveLink: string;
    priority: string;
    estimatedHours: number | null;
    dueDate: string | null;
  }) => Promise<void> | void;
  onLoadMessages?: (taskId: number) => Promise<TaskChatMessage[]>;
  onSendMessage?: (taskId: number, content: string) => Promise<TaskChatMessage>;
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
  onEditTask,
  onLoadMessages,
  onSendMessage,
  onUpdateStatus,
  busy = false,
}: TaskDetailPanelBodyProps) {
  const taskStatus = normalizeTaskStatus(task.status);
  const [currentTime] = useState(() => Date.now());
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editTaskName, setEditTaskName] = useState(task.taskName);
  const [editCategory, setEditCategory] = useState(task.category ?? '');
  const [editDescription, setEditDescription] = useState(task.description ?? '');
  const [editLinks, setEditLinks] = useState(task.links ?? '');
  const [editDriveLink, setEditDriveLink] = useState(task.driveLink ?? '');
  const [editPriority, setEditPriority] = useState(task.priority ?? 'MEDIUM');
  const [editEstimatedHours, setEditEstimatedHours] = useState(task.estimatedHours?.toString() ?? '');
  const [editDueDate, setEditDueDate] = useState(task.dueDate?.slice(0, 10) ?? '');
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [statusDraft, setStatusDraft] = useState<TaskStatus>(() => normalizeTaskStatus(task.status));
  const [chatMessages, setChatMessages] = useState<TaskChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatTab, setChatTab] = useState(false);

  const isEmployee = role === 'EMPLOYEE';
  const isManagerOrAdmin = role === 'ADMIN' || role === 'MANAGER';
  const isAssignee = Boolean(currentUserId != null && task.assignedToUserId === currentUserId);
  const canEmployeeAct = isEmployee && isAssignee;
  const canReview = isManagerOrAdmin && taskStatus === 'SUBMITTED';
  const canEdit = Boolean(onEditTask) && isManagerOrAdmin;
  const canChangeStatus = isManagerOrAdmin && taskStatus !== 'SUBMITTED';
  const showSubmissionSection = canEmployeeAct && (taskStatus === 'IN_PROGRESS' || taskStatus === 'REJECTED');
  const showStartButton = canEmployeeAct && taskStatus === 'PENDING';
  const showAwaitingReview = taskStatus === 'SUBMITTED';
  const showApproved = taskStatus === 'APPROVED';
  const showRejectResubmit = canEmployeeAct && taskStatus === 'REJECTED';

  useEffect(() => {
    setChatMessages([]);
    setChatDraft('');
    setChatError('');
    setChatTab(false);
  }, [task.id]);

  useEffect(() => {
    if (!chatTab || !onLoadMessages) return;
    let cancelled = false;
    let timer: number | null = null;

    const loadMessages = async (showLoading: boolean) => {
      if (showLoading) setChatLoading(true);
      try {
        const messages = await onLoadMessages(task.id);
        if (!cancelled) {
          setChatMessages(messages);
          setChatError('');
        }
      } catch (error) {
        if (!cancelled) {
          setChatError(error instanceof Error ? error.message : 'Unable to load task messages.');
        }
      } finally {
        if (!cancelled) {
          setChatLoading(false);
          timer = window.setTimeout(() => void loadMessages(false), 5000);
        }
      }
    };

    void loadMessages(true);
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [chatTab, onLoadMessages, task.id]);

  async function handleSendChat() {
    const content = chatDraft.trim();
    if (!content || !onSendMessage) return;
    try {
      const message = await onSendMessage(task.id, content);
      setChatMessages((previous) => [...previous, message]);
      setChatDraft('');
      setChatError('');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Unable to send task message.');
    }
  }

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
      <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div
          className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Task details · #{task.id}</p>
            <h2 className="mt-1 wrap-break-word text-xl font-semibold text-slate-950 sm:text-2xl">{task.taskName}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[taskStatus] ?? STATUS_BADGE.PENDING}`}><Clock3 className="h-3.5 w-3.5" />{taskStatus.replace('_', ' ')}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_BADGE[(task.priority ?? 'LOW').toUpperCase()] ?? PRIORITY_BADGE.LOW}`}><Flag className="h-3.5 w-3.5" />{(task.priority ?? 'LOW').toUpperCase()}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600"><FolderKanban className="h-3.5 w-3.5" />{task.category?.trim() || 'Other'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            aria-label="Close task details"
            title="Close task details"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-slate-200 px-5 sm:px-6">
          <button
            type="button"
            onClick={() => setChatTab((current) => !current)}
            disabled={!onLoadMessages || !onSendMessage}
            className={`inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium ${chatTab ? 'border-orange-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <MessageCircle className="h-4 w-4" />Task chat
          </button>
        </div>

        {chatTab && (
          <div className="space-y-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div className="h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {chatLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading messages...</div>
              ) : chatMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">No messages yet. Start the conversation.</div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[80%]">
                        <p className="mb-1 text-[11px] text-slate-500">{message.senderId === currentUserId ? 'You' : message.senderName}</p>
                        <p className={`rounded-2xl px-3 py-2 text-sm ${message.senderId === currentUserId ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>{message.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {chatError && <p className="text-sm text-rose-600">{chatError}</p>}
            <div className="flex gap-2">
              <input
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSendChat();
                  }
                }}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Write a message..."
              />
              <button type="button" onClick={() => void handleSendChat()} disabled={!chatDraft.trim() || chatLoading} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Send
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Task details</h3>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 py-3"><UserRound className="h-4 w-4 shrink-0 text-slate-400" /><div className="min-w-0"><p className="text-xs text-slate-500">Assigned to</p><UserIdentity userId={task.assignedToUser?.id} name={task.assignedToUser?.name ?? task.assignee} subtitle={task.assignedToUser?.email} size="md" /></div></div>
              <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 py-3"><UserRoundCog className="h-4 w-4 shrink-0 text-slate-400" /><div className="min-w-0"><p className="text-xs text-slate-500">Assigned by</p><p className="text-sm font-medium text-slate-800">{task.assignedByUser?.name ?? 'N/A'}</p></div></div>
              <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 py-3"><CalendarDays className={`h-4 w-4 shrink-0 ${isPastDue ? 'text-rose-500' : 'text-slate-400'}`} /><div><p className="text-xs text-slate-500">Due date</p><p className={`text-sm font-medium ${isPastDue ? 'text-rose-600' : 'text-slate-800'}`}>{formatDate(task.dueDate)}</p></div></div>
              <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 py-3"><Clock3 className="h-4 w-4 shrink-0 text-slate-400" /><div><p className="text-xs text-slate-500">Created</p><p className="text-sm font-medium text-slate-800">{formatDate(task.createdAt)}</p></div></div>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Instructions</h3>
            <div className="whitespace-pre-wrap wrap-break-word text-sm leading-6 text-slate-600">
              {task.description?.trim() ? task.description : 'No instructions provided.'}
            </div>
            {canEdit && !showEditForm && (
              <button
                type="button"
                onClick={() => setShowEditForm(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Pencil className="h-4 w-4" />Edit task
              </button>
            )}
            {showEditForm && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <input
                  value={editTaskName}
                  onChange={(event) => setEditTaskName(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Task title"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Category"
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="0.25"
                    value={editEstimatedHours}
                    onChange={(event) => setEditEstimatedHours(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Estimate in hours (needed for countdown)"
                  />
                  <select value={editPriority} onChange={(event) => setEditPriority(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Task description and instructions"
                />
                <input
                  value={editLinks}
                  onChange={(event) => setEditLinks(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Reference links separated by commas"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="url" value={editDriveLink} onChange={(event) => setEditDriveLink(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Google Drive link" />
                  <input type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      await onEditTask?.(task.id, {
                        taskName: editTaskName.trim(),
                        category: editCategory.trim(),
                        description: editDescription,
                        links: editLinks,
                        driveLink: editDriveLink.trim(),
                        priority: editPriority,
                        estimatedHours: editEstimatedHours ? Number(editEstimatedHours) : null,
                        dueDate: editDueDate || null,
                      });
                      setShowEditForm(false);
                    }}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Save changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditForm(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {task.driveLink && (
              <a
                href={task.driveLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-orange-600"
              >
                <ExternalLink className="h-4 w-4" />Google Drive
              </a>
            )}
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
                    className="inline-flex items-start gap-2 break-all text-sm text-slate-700 hover:text-orange-600"
                  >
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />{link}
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />Start Task
              </button>
            )}

            {showSubmissionSection && !showRejectResubmit && !showSubmitForm && (
              <button
                onClick={() => setShowSubmitForm(true)}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />Submit Work
              </button>
            )}

            {showRejectResubmit && !showSubmitForm && (
              <button
                onClick={() => setShowSubmitForm(true)}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />Resubmit
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
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />Submit for Review
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />Review submission
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
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />Approve
                  </button>
                  <button
                    onClick={() => onReviewTask(task.id, { status: 'REJECTED', remarks: reviewRemarks.trim() })}
                    disabled={busy}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />Reject
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
