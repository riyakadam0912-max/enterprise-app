'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createFormSubmission, CreateFormSubmissionPayload } from '../../../../src/api/formSubmissionsApi';

const EMPTY: CreateFormSubmissionPayload = {
  form: '',
  submissionDate: '',
  data: '',
};

export default function AddFormSubmissionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFormName = searchParams.get('formName')?.trim() ?? '';
  const selectedFormCode = searchParams.get('formCode')?.trim() ?? '';
  const [form, setForm]   = useState<CreateFormSubmissionPayload>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function set(field: keyof CreateFormSubmissionPayload, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createFormSubmission({
        form: (selectedFormName || form.form).trim(),
        submissionDate: form.submissionDate || undefined,
        data: form.data || undefined,
      });
      router.push('/dashboard/forms/status');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create submission');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Submit Form</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Complete the available fields and submit your form.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        {selectedFormName ? (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-orange-600">Selected Form</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{selectedFormName}</p>
            {selectedFormCode ? (
              <p className="mt-1 text-xs text-slate-500">Code: <span className="font-mono text-slate-700">{selectedFormCode}</span></p>
            ) : null}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Form <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.form}
              onChange={(e) => set('form', e.target.value)}
              className="w-full px-3 py-2 text-sm border-2 border-orange-400 rounded-lg outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
        )}

        {/* Submission Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Submission Date</label>
          <input
            type="datetime-local"
            value={form.submissionDate ?? ''}
            onChange={(e) => set('submissionDate', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>

        {/* Data */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Submission Details</label>
          <textarea
            rows={4}
            value={form.data ?? ''}
            onChange={(e) => set('data', e.target.value)}
            placeholder="Enter the form details you want to submit."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-orange-400 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Submit'}
          </button>
          <button
            type="button"
            onClick={() => setForm(EMPTY)}
            className="px-6 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
