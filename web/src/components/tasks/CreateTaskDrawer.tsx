'use client';

import { useEffect, useState } from 'react';
import { createTask } from '@/api/tasksApi';
import { getProjects, type Project } from '@/api/projectsApi';
import { apiClient } from '@/api/apiClient';
import { canManageProjects } from '@/utils/auth/permissions';
import { reportError } from '@/lib/error-handling';
import { useAuthSession } from '@/stores/auth-store';
import { dateTimeLocalToIso } from '@/utils/dateUtils';

type CreateTaskDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
};

type AssignableUser = { id: number; name: string; role: string; managerId?: number | null };

const PRIORITIES = [
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];
const STATUSES = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'];
const field = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100';

const emptyForm = {
  taskName: '',
  project: '',
  projectId: '',
  assignee: '',
  assignedToUserId: '',
  dueDate: '',
  priority: '',
  status: '',
  estimatedHours: '',
  actualHours: '',
  notes: '',
  driveLink: '',
};

export default function CreateTaskDrawer({ open, onClose, onCreated }: CreateTaskDrawerProps) {
  const authSession = useAuthSession();
  const role = authSession.role;
  const currentUserId = authSession.user?.id ?? null;
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    async function loadOptions() {
      try {
        setProjects(await getProjects());
      } catch (loadError) {
        reportError(loadError, 'Unable to load projects');
        setProjects([]);
      }

      if (!canManageProjects(role)) return;

      try {
        const users = await apiClient<AssignableUser[]>('/users/assignable');
        if (role === 'MANAGER' && currentUserId) {
          setAssignableUsers(users.filter((user) => user.role === 'EMPLOYEE' && user.managerId === currentUserId));
        } else if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
          setAssignableUsers(users.filter((user) => user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN'));
        } else {
          setAssignableUsers([]);
        }
      } catch (loadError) {
        reportError(loadError, 'Unable to load assignable users');
        setAssignableUsers([]);
      }
    }

    void loadOptions();
  }, [currentUserId, open, role]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open, saving]);

  function set(key: keyof typeof emptyForm, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.taskName.trim()) {
      setError('Task name is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createTask({
        taskName: form.taskName.trim(),
        project: form.project.trim() || null,
        projectId: form.projectId ? Number(form.projectId) : undefined,
        assignee: form.assignee.trim() || null,
        assignedToUserId: form.assignedToUserId ? Number(form.assignedToUserId) : undefined,
        dueDate: dateTimeLocalToIso(form.dueDate),
        priority: form.priority || null,
        status: form.status || 'PENDING',
        estimatedHours: form.estimatedHours ? Number.parseFloat(form.estimatedHours) : null,
        actualHours: form.actualHours ? Number.parseFloat(form.actualHours) : null,
        notes: form.notes.trim() || null,
        driveLink: form.driveLink.trim() || undefined,
      });
      setForm(emptyForm);
      await onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create task. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close create task drawer"
        onClick={onClose}
        disabled={saving}
        className="fixed inset-0 z-[60] cursor-default bg-slate-950/20 disabled:cursor-wait"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-xl flex-col bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Task details</p>
            <h2 id="create-task-title" className="mt-1 text-xl font-semibold text-slate-950">Create task</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-2xl leading-none text-slate-400 hover:text-slate-900 disabled:opacity-50"
            aria-label="Close create task drawer"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
            {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>}

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Task name</span>
              <input autoFocus required className={field} value={form.taskName} onChange={(event) => set('taskName', event.target.value)} placeholder="Enter task name" />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Project <span className="font-normal text-slate-400">(optional)</span></span>
              <select
                className={field}
                value={form.projectId}
                onChange={(event) => {
                  const selected = projects.find((project) => String(project.id) === event.target.value);
                  setForm((previous) => ({ ...previous, projectId: event.target.value, project: selected?.projectName ?? '' }));
                }}
              >
                <option value="">Personal task (no project)</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.projectName}</option>)}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Assignee <span className="font-normal text-slate-400">(optional)</span></span>
              <select
                className={field}
                value={form.assignedToUserId}
                onChange={(event) => {
                  const selected = assignableUsers.find((user) => String(user.id) === event.target.value);
                  setForm((previous) => ({ ...previous, assignedToUserId: event.target.value, assignee: selected?.name ?? '' }));
                }}
              >
                <option value="">Myself</option>
                {assignableUsers.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Due date and time</span>
              <input type="datetime-local" className={field} value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} />
              <span className="block text-xs text-slate-500">Time uses your device&apos;s local timezone.</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Priority</span>
                <select className={field} value={form.priority} onChange={(event) => set('priority', event.target.value)}>
                  <option value="">Select priority</option>
                  {PRIORITIES.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Status</span>
                <select className={field} value={form.status} onChange={(event) => set('status', event.target.value)}>
                  <option value="">Default (Pending)</option>
                  {STATUSES.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Estimated hours</span>
                <input type="number" min="0" step="0.01" className={field} value={form.estimatedHours} onChange={(event) => set('estimatedHours', event.target.value)} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Actual hours</span>
                <input type="number" min="0" step="0.01" className={field} value={form.actualHours} onChange={(event) => set('actualHours', event.target.value)} />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Google Drive link <span className="font-normal text-slate-400">(optional)</span></span>
              <input type="url" className={field} value={form.driveLink} onChange={(event) => set('driveLink', event.target.value)} placeholder="https://drive.google.com/..." />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea rows={4} className={field} value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Add notes..." />
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create task'}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}