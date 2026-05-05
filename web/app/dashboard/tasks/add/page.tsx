'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTask } from '@/api/tasksApi';
import { getProjects, type Project } from '@/api/projectsApi';
import { apiClient } from '@/api/apiClient';

const PRIORITIES = ['High', 'Low', 'Medium', 'Critical'];
const STATUSES   = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'];

const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400';

export default function AddTaskPage() {
  const router = useRouter();
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<Array<{ id: number; name: string; role: string; managerId?: number | null }>>([]);

  const [form, setForm] = useState({
    taskName:       '',
    project:        '',
    projectId:      '',
    assignee:       '',
    assignedToUserId: '',
    dueDate:        '',
    priority:       '',
    status:         '',
    estimatedHours: '',
    actualHours:    '',
    notes:          '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    getProjects().then(setProjects).catch(() => setProjects([]));
    apiClient<Array<{ id: number; name: string; role: string; managerId?: number | null }>>('/users/assignable')
      .then((users) => {
        if (role === 'MANAGER' && currentUserId) {
          setAssignableUsers(users.filter((user) => user.role === 'EMPLOYEE' && user.managerId === currentUserId));
          return;
        }
        if (role === 'ADMIN') {
          setAssignableUsers(users.filter((user) => user.role !== 'ADMIN'));
          return;
        }
        setAssignableUsers([]);
      })
      .catch(() => setAssignableUsers([]));
  }, [currentUserId, role]);

  function set(key: keyof typeof form, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.taskName.trim()) { setError('Task Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (!form.projectId) {
        setError('Please select a project');
        setSaving(false);
        return;
      }

      if (!form.assignedToUserId) {
        setError('Please assign this task to a user');
        setSaving(false);
        return;
      }

      await createTask({
        taskName:       form.taskName.trim(),
        project:        form.project.trim()        || null,
        projectId:      Number(form.projectId),
        assignee:       form.assignee.trim()       || null,
        assignedToUserId: Number(form.assignedToUserId),
        dueDate:        form.dueDate               || null,
        priority:       form.priority              || null,
        status:         form.status                || 'PENDING',
        estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
        actualHours:    form.actualHours    ? parseFloat(form.actualHours)    : null,
        notes:          form.notes.trim()          || null,
      });
      router.push('/dashboard/tasks');
    } catch {
      setError('Failed to create task. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Tasks</h1>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

        {/* Task Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
          <input
            className={field}
            value={form.taskName}
            onChange={(e) => set('taskName', e.target.value)}
            placeholder="Enter task name"
          />
        </div>

        {/* Project */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
          <select
            className={field}
            value={form.projectId}
            onChange={(e) => {
              const selected = projects.find((project) => String(project.id) === e.target.value);
              set('projectId', e.target.value);
              set('project', selected?.projectName ?? '');
            }}
          >
            <option value="">-Select project-</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.projectName}</option>
            ))}
          </select>
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
          <select
            className={field}
            value={form.assignedToUserId}
            onChange={(e) => {
              const selected = assignableUsers.find((user) => String(user.id) === e.target.value);
              set('assignedToUserId', e.target.value);
              set('assignee', selected?.name ?? '');
            }}
          >
            <option value="">-Select assignee-</option>
            {assignableUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
            ))}
          </select>
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
          <input type="date" className={field} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select className={field} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            <option value="">-Select-</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select className={field} value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">-Select-</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Estimated Hours */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={field}
            value={form.estimatedHours}
            onChange={(e) => set('estimatedHours', e.target.value)}
            placeholder="#######"
          />
        </div>

        {/* Actual Hours */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Actual Hours</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={field}
            value={form.actualHours}
            onChange={(e) => set('actualHours', e.target.value)}
            placeholder="#######"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            rows={4}
            className={field}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Add notes..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Submit'}
          </button>
          <button
            type="button"
            onClick={() => setForm({ taskName:'', project:'', projectId:'', assignee:'', assignedToUserId:'', dueDate:'', priority:'', status:'', estimatedHours:'', actualHours:'', notes:'' })}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
