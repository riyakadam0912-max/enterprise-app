'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/api/apiClient';
import { getEmployees, Employee } from '@/api/employeesApi';
import { reportError, retryAsync, getErrorMessage } from '@/lib/error-handling';

const STATUS_OPTIONS = ['Submitted', 'Approved', 'Rejected'];

const EMPTY_FORM = {
  employeeId: '',
  task: '',
  date: '',
  hours: '',
  status: 'Submitted',
  project: '',
  notes: '',
};

export default function AddTimesheetPage() {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEmployees() {
      try {
        setEmployees(await retryAsync(() => getEmployees(), 2, 200));
      } catch (error) {
        reportError(error, 'Unable to load employees');
      }
    }

    loadEmployees();
  }, []);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient('/timesheets', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: form.employeeId ? parseInt(form.employeeId) : undefined,
          task: form.task,
          date: form.date,
          hours: parseFloat(form.hours),
          status: form.status.toUpperCase(),
          project: form.project || undefined,
          notes: form.notes || undefined,
        }),
      });
      router.push('/dashboard/timesheets');
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to save timesheet');
      setError(message);
      reportError(err, 'Timesheet submission failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({ ...EMPTY_FORM });
    setError(null);
  };

  const fieldClass = 'w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1 w-32 shrink-0 pt-2';

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Submit time like a proper work log</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">Keka-style timesheets work best when the submission form is short, structured, and tied to approval status.</p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-5">

          {/* Employee */}
          <div className="flex items-start gap-4">
            <label className={labelClass}>Employee</label>
            <div className="flex-1">
              <select
                value={form.employeeId}
                onChange={(e) => set('employeeId', e.target.value)}
                className={fieldClass}
              >
                <option value=""></option>
                {employees.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>{emp.id}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Task */}
          <div className="flex items-start gap-4">
            <label className={labelClass}>Task</label>
            <div className="flex-1">
              <input
                type="text"
                value={form.task}
                onChange={(e) => set('task', e.target.value)}
                required
                className={fieldClass}
              />
            </div>
          </div>

          {/* Date */}
          <div className="flex items-start gap-4">
            <label className={labelClass}>Date</label>
            <div className="flex-1">
              <input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                required
                className={fieldClass}
              />
            </div>
          </div>

          {/* Hours */}
          <div className="flex items-start gap-4">
            <label className={labelClass}>Hours</label>
            <div className="flex-1">
              <input
                type="number"
                min="0.25"
                step="0.25"
                value={form.hours}
                onChange={(e) => set('hours', e.target.value)}
                required
                className={fieldClass}
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex items-start gap-4">
            <label className={labelClass}>Status</label>
            <div className="flex-1">
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className={fieldClass}
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Project */}
          <div className="flex items-start gap-4">
            <label className={labelClass}>Project</label>
            <div className="flex-1">
              <input
                type="text"
                value={form.project}
                onChange={(e) => set('project', e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="flex items-start gap-4">
            <label className={labelClass}>Notes</label>
            <div className="flex-1">
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                className={`${fieldClass} resize-none`}
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm ml-36">{error}</p>}

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2 ml-36">
            <button
              type="submit"
              disabled={saving}
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-6 py-2 rounded transition-colors disabled:opacity-50"
            >
              {saving ? 'Submitting…' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="border border-slate-300 text-slate-700 text-sm font-medium px-6 py-2 rounded hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
          </div>

          </form>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">What makes a good timesheet</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Task should describe the actual work completed.</li>
              <li>Status should reflect the real approval state.</li>
              <li>Project and notes help managers approve faster.</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Approval cue</p>
            <p className="mt-2 text-sm text-slate-500">Submitted entries go to the manager queue. Approved entries can be used downstream for reporting and payroll visibility.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
