'use client';

import { useEffect, useState } from 'react';
import { createTask } from '@/api/tasksApi';
import { getProjects, type Project } from '@/api/projectsApi';
import { apiClient } from '@/api/apiClient';
import { canAccessUsers, canManageProjects } from '@/utils/auth/permissions';
import { reportError } from '@/lib/error-handling';
import { useAuthSession } from '@/stores/auth-store';
import { dateTimeLocalToIso, getCurrentDateTimeLocalValue } from '@/utils/dateUtils';

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

const buildEmptyForm = () => ({
  taskName: '',
  taskType: 'GENERAL',
  shootClientName: '',
  shootLocation: '',
  shootDate: '',
  shootReportingTime: '',
  shootEstimatedHours: '',
  shootCrewUserIds: [] as string[],
  project: '',
  projectId: '',
  assignee: '',
  assignedToUserId: '',
  dueDate: getCurrentDateTimeLocalValue(),
  priority: '',
  status: '',
  estimatedHours: '',
  actualHours: '',
  notes: '',
  driveLink: '',
});

export default function CreateTaskDrawer({ open, onClose, onCreated }: CreateTaskDrawerProps) {
  const authSession = useAuthSession();
  const role = authSession.role;
  const currentUserId = authSession.user?.id ?? null;
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [form, setForm] = useState(buildEmptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role !== 'EMPLOYEE' || currentUserId == null) return;
    setForm((previous) => previous.assignedToUserId
      ? previous
      : { ...previous, assignedToUserId: String(currentUserId), assignee: authSession.user?.name ?? '' });
  }, [authSession.user?.name, currentUserId, role]);

  useEffect(() => {
    if (!open) return;

    async function loadOptions() {
      try {
        setProjects(await getProjects());
      } catch (loadError) {
        reportError(loadError, 'Unable to load projects');
        setProjects([]);
      }

      if (!canManageProjects(role) && !canAccessUsers(role)) return;

      try {
        const users = await apiClient<AssignableUser[]>('/users/assignable');
        if (role === 'MANAGER' && currentUserId) {
          setAssignableUsers(users.filter((user) => user.role === 'EMPLOYEE' && user.managerId === currentUserId));
        } else {
          setAssignableUsers(users);
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

  function set(key: keyof ReturnType<typeof buildEmptyForm>, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function assignToMe() {
    if (currentUserId == null) return;
    setForm((previous) => ({ ...previous, assignedToUserId: String(currentUserId), assignee: authSession.user?.name ?? '' }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.taskName.trim()) {
      setError('Task name is required.');
      return;
    }
    if (!form.assignedToUserId) {
      setError('Choose an assignee or select Assign to me.');
      return;
    }
    const shootDuration = Number.parseFloat(form.shootEstimatedHours);
    if (
      form.taskType === 'SHOOT' &&
      (!form.shootClientName.trim() ||
        !form.shootLocation.trim() ||
        !form.shootDate ||
        !form.shootReportingTime ||
        !Number.isFinite(shootDuration) ||
        shootDuration <= 0 ||
        !form.shootCrewUserIds.length)
    ) {
      setError('Complete the shoot details and add at least one crew member.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createTask({
        taskName: form.taskName.trim(),
        taskType: form.taskType === 'SHOOT' ? 'SHOOT' : 'GENERAL',
        ...(form.taskType === 'SHOOT' && {
          shootClientName: form.shootClientName.trim(),
          shootLocation: form.shootLocation.trim(),
          shootDate: form.shootDate,
          shootReportingTime: form.shootReportingTime,
          shootEstimatedHours: shootDuration,
          shootCrewUserIds: form.shootCrewUserIds.map(Number),
        }),
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
      setForm(role === 'EMPLOYEE' && currentUserId != null
        ? { ...buildEmptyForm(), assignedToUserId: String(currentUserId), assignee: authSession.user?.name ?? '' }
        : buildEmptyForm());
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
        className="fixed inset-0 z-60 cursor-default bg-slate-950/20 disabled:cursor-wait"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        className="fixed inset-y-0 right-0 z-70 flex w-full max-w-xl flex-col bg-white shadow-2xl"
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
              <span className="text-sm font-medium text-slate-700">Task type</span>
              <select
                className={field}
                value={form.taskType}
                onChange={(event) => set('taskType', event.target.value)}
              >
                <option value="GENERAL">Standard task</option>
                <option value="SHOOT">Shoot</option>
              </select>
            </label>

            {form.taskType === 'SHOOT' && (
              <section className="space-y-4 rounded-xl border border-orange-100 bg-orange-50/40 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Shoot details</h3>
                  <p className="mt-1 text-xs text-slate-500">Crew members are credited for attendance on this date without clock-in or clock-out.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">Client name</span>
                    <input required className={field} value={form.shootClientName} onChange={(event) => set('shootClientName', event.target.value)} placeholder="Client or brand" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">Shoot location</span>
                    <input required className={field} value={form.shootLocation} onChange={(event) => set('shootLocation', event.target.value)} placeholder="Studio, venue, or address" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">Shoot date</span>
                    <input type="date" required className={field} value={form.shootDate} onChange={(event) => set('shootDate', event.target.value)} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">Reporting time</span>
                    <input type="time" required className={field} value={form.shootReportingTime} onChange={(event) => set('shootReportingTime', event.target.value)} />
                  </label>
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-medium text-slate-700">Estimated duration (hours)</span>
                    <input type="number" required min="0.25" step="0.25" className={field} value={form.shootEstimatedHours} onChange={(event) => set('shootEstimatedHours', event.target.value)} placeholder="e.g. 8" />
                  </label>
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-slate-700">Shoot crew</legend>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                    {assignableUsers.length ? assignableUsers.map((user) => (
                      <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={form.shootCrewUserIds.includes(String(user.id))}
                          onChange={(event) => setForm((previous) => ({
                            ...previous,
                            shootCrewUserIds: event.target.checked
                              ? [...previous.shootCrewUserIds, String(user.id)]
                              : previous.shootCrewUserIds.filter((id) => id !== String(user.id)),
                          }))}
                          className="h-4 w-4 rounded border-slate-300 accent-orange-500"
                        />
                        <span className="min-w-0 flex-1 truncate">{user.name}</span>
                        <span className="text-xs text-slate-400">{user.role.replace('_', ' ')}</span>
                      </label>
                    )) : (
                      <p className="px-2 py-3 text-sm text-slate-500">No eligible crew members are available.</p>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{form.shootCrewUserIds.length} crew member{form.shootCrewUserIds.length === 1 ? '' : 's'} selected</p>
                </fieldset>
              </section>
            )}

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
              <span className="text-sm font-medium text-slate-700">Assignee</span>
              <div className="flex gap-2">
                <select className={`${field} min-w-0 flex-1`} value={form.assignedToUserId} disabled={role === 'EMPLOYEE'} onChange={(event) => {
                  const selected = assignableUsers.find((user) => String(user.id) === event.target.value);
                  setForm((previous) => ({ ...previous, assignedToUserId: event.target.value, assignee: selected?.name ?? '' }));
                }}>
                  <option value="">Select assignee</option>
                  {assignableUsers.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}
                </select>
                <button type="button" onClick={assignToMe} disabled={currentUserId == null} className="shrink-0 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50">Assign to me</button>
              </div>
              {role === 'EMPLOYEE' && <span className="block text-xs text-slate-500">Employees can only assign tasks to themselves.</span>}
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Due date and time</span>
              <div className="flex items-center gap-2">
                <input type="datetime-local" className={`${field} flex-1`} value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} />
                <button
                  type="button"
                  onClick={() => set('dueDate', getCurrentDateTimeLocalValue())}
                  className="shrink-0 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                >
                  Now
                </button>
              </div>
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
