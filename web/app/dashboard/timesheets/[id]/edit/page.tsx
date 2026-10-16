'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getTimesheet, updateTimesheet } from '@/api/timesheetsApi';
import { getErrorMessage, reportError } from '@/lib/error-handling';

type FormValues = {
  task: string;
  date: string;
  hours: string;
  project: string;
  notes: string;
};

const EMPTY_FORM: FormValues = {
  task: '',
  date: '',
  hours: '',
  project: '',
  notes: '',
};

export default function EditTimesheetPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const timesheetId = Number(params.id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTimesheet() {
      if (!Number.isInteger(timesheetId) || timesheetId <= 0) {
        setError('Invalid timesheet.');
        setLoading(false);
        return;
      }

      try {
        const entry = await getTimesheet(timesheetId);
        if (!['PENDING', 'REJECTED'].includes(entry.status.toUpperCase())) {
          setError('Only draft or returned timesheets can be edited.');
          return;
        }
        setForm({
          task: entry.task,
          date: entry.date.slice(0, 10),
          hours: String(entry.hours),
          project: entry.project ?? '',
          notes: entry.notes ?? '',
        });
        setStatus(entry.status);
        setRejectionReason(entry.rejectionReason ?? null);
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError, 'Unable to load this timesheet.'));
        reportError(loadError, 'Unable to load timesheet for editing');
      } finally {
        setLoading(false);
      }
    }

    void loadTimesheet();
  }, [timesheetId]);

  const set = (key: keyof FormValues, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateTimesheet(timesheetId, {
        task: form.task.trim(),
        date: form.date,
        hours: Number.parseFloat(form.hours),
        project: form.project.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      router.push('/dashboard/timesheets');
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, 'Unable to save this timesheet.'));
      reportError(saveError, 'Timesheet update failed');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100';

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link href="/dashboard/timesheets" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          Back to timesheets
        </Link>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-600">Work log</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Edit timesheet</h1>
        <p className="mt-2 text-sm text-slate-500">Update your entry, then submit it for review when it’s ready.</p>
      </section>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Loading timesheet…</p>
        ) : (
          <>
            {status === 'REJECTED' && rejectionReason && (
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Returned for edits</p>
                <p className="mt-1 text-sm text-rose-800">{rejectionReason}</p>
              </div>
            )}
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Task
              <input required value={form.task} onChange={(event) => set('task', event.target.value)} className={fieldClass} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Date
                <input required type="date" value={form.date} onChange={(event) => set('date', event.target.value)} className={fieldClass} />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Hours
                <input required type="number" min="0.25" step="0.25" value={form.hours} onChange={(event) => set('hours', event.target.value)} className={fieldClass} />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Project
              <input value={form.project} onChange={(event) => set('project', event.target.value)} className={fieldClass} />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Notes
              <textarea rows={4} value={form.notes} onChange={(event) => set('notes', event.target.value)} className={`${fieldClass} resize-y`} />
            </label>
          </>
        )}

        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Link href="/dashboard/timesheets" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </Link>
          <button type="submit" disabled={loading || saving || Boolean(error)} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
