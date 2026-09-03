'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/api/projectsApi';
import { apiClient } from '@/api/apiClient';
import { canAccessUsers } from '@/utils/auth/permissions';
import { reportError } from '@/lib/error-handling';
import { getAuthSessionSnapshot } from '@/stores/auth-store';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'IN_APPROVAL', 'BLOCKED_CANCELLED', 'POSTPONED', 'COMPLETED'];
const PROJECT_TYPES = ['EVENT_MANAGEMENT', 'PRODUCTION_EM', 'DIGITAL_MARKETING', 'PRODUCTION_DM', 'PRODUCTION_OTHER', 'TECH_PROJECTS'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400';

type DashboardRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

function parseSession() {
  if (typeof window === 'undefined') {
    return { role: 'EMPLOYEE' as DashboardRole, userId: null as number | null, name: '' };
  }

  const snapshot = getAuthSessionSnapshot();
  const role = (snapshot.role === 'SUPER_ADMIN' || snapshot.role === 'MANAGER' || snapshot.role === 'ADMIN' ? snapshot.role : 'EMPLOYEE') as DashboardRole;
  const user = snapshot.user;

  return { role, userId: user?.id ?? null, name: user?.name ?? '' };
}

export default function AddProjectPage() {
  const router = useRouter();
  const [session] = useState(parseSession);
  const [managers, setManagers] = useState<Array<{ id: number; name: string; role: string }>>([]);
  const [managerOptions, setManagerOptions] = useState<Array<{ id: number; name: string; role: string }>>([]);

  const [form, setForm] = useState({
    projectName: '',
    startDate:   '',
    endDate:     '',
    manager:     session.role === 'MANAGER' ? session.name : '',
    managerId:   session.role === 'MANAGER' && session.userId ? String(session.userId) : '',
    ownerId:     '',
    status:      '',
    description: '',
    client:      '',
    category:    '',
    projectType: '',
    specificTask: '',
    priority:    'MEDIUM',
    budget:      '',
    remarks:     '',
    finalDeliverablesLink: '',
    driveLink:                '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const canCreateProject = session.role === 'SUPER_ADMIN' || session.role === 'ADMIN' || session.role === 'MANAGER';

  useEffect(() => {
    if (!canAccessUsers(session.role)) {
      setManagers([]);
      return;
    }

    // Load eligible managers and owners (includes platform super admins)
    apiClient<Array<{ id: number; name: string; role: string }>>('/projects/eligible-managers')
      .then((users) => setManagers(users))
      .catch((error) => {
        reportError(error, 'Unable to load project managers');
        setManagers([]);
      });
  }, [session.name, session.role, session.userId]);

  useEffect(() => {
    const fallbackManager = session.role === 'MANAGER' && session.userId
      ? [{ id: session.userId, name: session.name || 'Me', role: 'MANAGER' }]
      : [];

    const merged = [...fallbackManager, ...managers.filter((manager) => manager.id !== session.userId)];
    setManagerOptions(merged);

    if (session.role === 'MANAGER') {
      const hasCurrentUser = merged.some((manager) => manager.id === session.userId);
      setForm((prev) => ({
        ...prev,
        manager: prev.manager || session.name,
        managerId: hasCurrentUser
          ? prev.managerId || (session.userId ? String(session.userId) : '')
          : prev.managerId,
      }));
    }
  }, [managers, session.name, session.role, session.userId]);

  function set(key: keyof typeof form, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreateProject) {
      setError('You do not have permission to create projects.');
      return;
    }
    if (!form.projectName.trim()) { setError('Project Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const managerId = form.managerId ? Number(form.managerId) : undefined;

      await createProject({
        projectName: form.projectName.trim(),
        startDate:   form.startDate          || undefined,
        endDate:     form.endDate            || undefined,
        manager:     form.manager.trim() || undefined,
        managerId,
        ownerId: form.ownerId ? Number(form.ownerId) : null,
        status:      form.status             || undefined,
        description: form.description.trim() || undefined,
        client:      form.client             || undefined,
        clientName:  form.client.trim()      || undefined,
        category:    form.category.trim()    || undefined,
        projectType: form.projectType        || undefined,
        specificTask: form.specificTask.trim() || undefined,
        priority:    form.priority           || undefined,
        budget:      form.budget ? Number(form.budget) : undefined,
        remarks:     form.remarks.trim()     || undefined,
        finalDeliverablesLink: form.finalDeliverablesLink.trim() || undefined,
        driveLink: form.driveLink.trim() || undefined,
      });
      router.push('/dashboard/projects');
    } catch {
      setError('Failed to create project. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Projects</h1>

      {!canCreateProject && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You do not have access to create projects.
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      {canCreateProject && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input
              className={field}
              value={form.projectName}
              onChange={(e) => set('projectName', e.target.value)}
              placeholder="Enter project name"
            />
          </div>

          {/* Project Owner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Owner (optional)</label>
            <select
              className={field}
              value={form.ownerId}
              onChange={(e) => {
                set('ownerId', e.target.value);
              }}
            >
              <option value="">-No owner assigned-</option>
              {managerOptions.filter((manager) => ['SUPER_ADMIN', 'ADMIN'].includes(manager.role)).map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name} ({manager.role}){manager.id === session.userId ? ' (You)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" className={field} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" className={field} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input className={field} value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Project category" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
            <select className={field} value={form.projectType} onChange={(e) => set('projectType', e.target.value)}>
              <option value="">-Select project type-</option>
              {PROJECT_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specific Task</label>
            <input className={field} value={form.specificTask} onChange={(e) => set('specificTask', e.target.value)} placeholder="Primary project task" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select className={field} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
            <input type="number" min="0" className={field} value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder="0" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea rows={3} className={field} value={form.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="Project remarks" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Drive link <span className="font-normal text-gray-400">(optional)</span></label>
            <input type="url" className={field} value={form.driveLink} onChange={(e) => set('driveLink', e.target.value)} placeholder="https://drive.google.com/..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Final Deliverables Link</label>
            <input type="url" className={field} value={form.finalDeliverablesLink} onChange={(e) => set('finalDeliverablesLink', e.target.value)} placeholder="https://..." />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={4}
              className={field}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Project description"
            />
          </div>

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <input
              className={field}
              value={form.client}
              onChange={(e) => set('client', e.target.value)}
              placeholder="Client name"
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
              onClick={() => setForm({
                projectName: '',
                startDate: '',
                endDate: '',
                manager: session.role === 'MANAGER' ? session.name : '',
                managerId: session.role === 'MANAGER' && session.userId ? String(session.userId) : '',
                ownerId: '',
                status: '',
                description: '',
                client: '',
                category: '',
                projectType: '',
                specificTask: '',
                priority: 'MEDIUM',
                budget: '',
                remarks: '',
                finalDeliverablesLink: '',
                driveLink: '',
              })}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
