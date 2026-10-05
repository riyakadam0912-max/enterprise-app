'use client';

import { CalendarDays, CircleCheck, CircleX, Clock3, Flag, FileText, FolderKanban, Pencil, UserRound, UserRoundCog, X } from 'lucide-react';
import { UserIdentity } from '@/components/common/UserIdentity';

type TaskDetailHeaderProps = {
  taskId: number;
  taskName: string;
  status: string;
  priority?: string | null;
  category?: string | null;
  overdue?: boolean;
  editing?: boolean;
  onEdit?: () => void;
  onClose: () => void;
};

type TaskDetailMetadataProps = {
  assigneeId?: number | null;
  assigneeName?: string | null;
  assigneeEmail?: string | null;
  assignerName?: string | null;
  dueDate?: string | null;
  project?: string | null;
  estimatedHours?: number | null;
  createdAt?: string | null;
  overdue?: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700 border-slate-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
  MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
  HIGH: 'bg-rose-50 text-rose-700 border-rose-200',
};

function formatTaskDate(value?: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TaskDetailHeader({
  taskId,
  taskName,
  status,
  priority,
  category,
  overdue = false,
  editing = false,
  onEdit,
  onClose,
}: TaskDetailHeaderProps) {
  const normalizedStatus = status.trim().toUpperCase() || 'PENDING';
  const normalizedPriority = priority?.trim().toUpperCase() || 'LOW';
  const StatusIcon = normalizedStatus === 'APPROVED'
    ? CircleCheck
    : normalizedStatus === 'REJECTED'
      ? CircleX
      : Clock3;

  return (
    <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7 sm:py-5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">Task details · #{taskId}</p>
        <h2 className="mt-1 wrap-break-word text-xl font-semibold text-slate-950 sm:text-2xl">{taskName}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[normalizedStatus] ?? STATUS_STYLES.PENDING}`}>
            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {normalizedStatus.replace('_', ' ')}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[normalizedPriority] ?? PRIORITY_STYLES.LOW}`}>
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />{normalizedPriority}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />{category?.trim() || 'Other'}
          </span>
          {overdue && <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">Overdue</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${editing ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
            aria-label={editing ? 'Exit edit mode' : 'Edit task'}
            aria-pressed={editing}
            title={editing ? 'Exit edit mode' : 'Edit task'}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          aria-label="Close task details"
          title="Close task details"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

export function TaskDetailMetadata({
  assigneeId,
  assigneeName,
  assigneeEmail,
  assignerName,
  dueDate,
  project,
  estimatedHours,
  createdAt,
  overdue = false,
}: TaskDetailMetadataProps) {
  return (
    <section aria-label="Task details">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Task details</h3>
      <div className="grid gap-x-8 sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 py-3">
          <UserRound className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="min-w-0"><p className="text-xs text-slate-500">Assigned to</p><UserIdentity userId={assigneeId} name={assigneeName} subtitle={assigneeEmail} /></div>
        </div>
        <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 py-3">
          <UserRoundCog className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="min-w-0"><p className="text-xs text-slate-500">Assigned by</p><p className="truncate text-sm font-medium text-slate-800">{assignerName || 'Not available'}</p></div>
        </div>
        <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 py-3">
          <CalendarDays className={`h-4 w-4 shrink-0 ${overdue ? 'text-rose-500' : 'text-slate-400'}`} aria-hidden="true" />
          <div className="min-w-0"><p className="text-xs text-slate-500">Due date</p><p className={`truncate text-sm font-medium ${overdue ? 'text-rose-600' : 'text-slate-800'}`}>{formatTaskDate(dueDate)}</p></div>
        </div>
        <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 py-3">
          <FolderKanban className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="min-w-0"><p className="text-xs text-slate-500">Project</p><p className="truncate text-sm font-medium text-slate-800">{project || 'No project'}</p></div>
        </div>
        <div className="flex min-w-0 items-center gap-3 py-3">
          <Clock3 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div><p className="text-xs text-slate-500">Estimate</p><p className="text-sm font-medium text-slate-800">{estimatedHours == null ? 'Not set' : `${estimatedHours} hours`}</p></div>
        </div>
        <div className="flex min-w-0 items-center gap-3 py-3">
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div><p className="text-xs text-slate-500">Created</p><p className="text-sm font-medium text-slate-800">{formatTaskDate(createdAt)}</p></div>
        </div>
      </div>
    </section>
  );
}
