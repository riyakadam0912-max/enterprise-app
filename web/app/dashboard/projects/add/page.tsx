'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/api/projectsApi';
import { apiClient } from '@/api/apiClient';

const STATUSES = ['ACTIVE', 'COMPLETED'];

const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400';

export default function AddProjectPage() {
  const router = useRouter();
  const [managers, setManagers] = useState<Array<{ id: number; name: string; role: string }>>([]);

  const [form, setForm] = useState({
    projectName: '',
    projectCode: '',
    startDate:   '',
    endDate:     '',
    manager:     '',
    managerId:   '',
    status:      '',
    description: '',
    client:      '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    apiClient<Array<{ id: number; name: string; role: string }>>('/users')
      .then((users) => setManagers(users.filter((user) => user.role === 'MANAGER')))
      .catch(() => setManagers([]));
  }, []);

  function set(key: keyof typeof form, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectName.trim()) { setError('Project Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (!form.managerId) {
        setError('Please assign a manager to this project');
        setSaving(false);
        return;
      }

      await createProject({
        projectName: form.projectName.trim(),
        projectCode: form.projectCode.trim() || undefined,
        startDate:   form.startDate          || undefined,
        endDate:     form.endDate            || undefined,
        manager:     form.manager.trim()     || undefined,
        managerId:   Number(form.managerId),
        status:      form.status             || undefined,
        description: form.description.trim() || undefined,
        client:      form.client             || undefined,
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

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
      )}

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

        {/* Project Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Code</label>
          <input
            className={field}
            value={form.projectCode}
            onChange={(e) => set('projectCode', e.target.value)}
            placeholder="e.g. PM-2026-001"
          />
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

        {/* Manager */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
          <select
            className={field}
            value={form.managerId}
            onChange={(e) => {
              const selected = managers.find((manager) => String(manager.id) === e.target.value);
              set('managerId', e.target.value);
              set('manager', selected?.name ?? '');
            }}
          >
            <option value="">-Select manager-</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>{manager.name}</option>
            ))}
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
            onClick={() => setForm({ projectName:'', projectCode:'', startDate:'', endDate:'', manager:'', managerId:'', status:'', description:'', client:'' })}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
