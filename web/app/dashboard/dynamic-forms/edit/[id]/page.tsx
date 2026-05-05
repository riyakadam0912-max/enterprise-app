'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useDynamicForm, editDynamicForm } from '@/hooks/useDynamicForms';

const STATUSES   = ['Draft', 'Active', 'Archived', 'Inactive'];
const FORM_TYPES = ['Lead Capture', 'Leave Request', 'Event Registration', 'Survey', 'Feedback', 'Other'];
const MODULES    = ['Sales', 'Events', 'Finance', 'HR', 'Operations', 'Marketing', 'IT', 'Other'];

export default function EditDynamicFormPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params?.id);

  const { form: data, loading: fetching, error: fetchError } = useDynamicForm(id);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [form, setForm] = useState({
    formName:     '',
    formCode:     '',
    description:  '',
    createdBy:    '',
    status:       '',
    formType:     '',
    targetModule: '',
    createdOn:    '',
  });

  useEffect(() => {
    if (data) {
      setForm({
        formName:     data.formName     ?? '',
        formCode:     data.formCode     ?? '',
        description:  data.description  ?? '',
        createdBy:    data.createdBy    ?? '',
        status:       data.status       ?? '',
        formType:     data.formType     ?? '',
        targetModule: data.targetModule ?? '',
        createdOn:    data.createdOn    ? data.createdOn.slice(0, 10) : '',
      });
    }
  }, [data]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.formName.trim()) { setError('Form Name is required.'); return; }
    setLoading(true);
    try {
      await editDynamicForm(id, {
        formName:     form.formName.trim(),
        formCode:     form.formCode.trim()    || undefined,
        description:  form.description.trim() || undefined,
        createdBy:    form.createdBy.trim()   || undefined,
        status:       form.status             || undefined,
        formType:     form.formType           || undefined,
        targetModule: form.targetModule       || undefined,
        createdOn:    form.createdOn          || undefined,
      });
      router.push('/dashboard/dynamic-forms');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update form');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm';

  if (fetching) {
    return <div className="p-6 text-slate-400">Loading…</div>;
  }
  if (fetchError) {
    return <div className="p-6 text-red-500">{fetchError}</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/dynamic-forms" className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Back">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Dynamic Form</h1>
          <p className="text-sm text-slate-500 mt-0.5">Update form details</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Form Name <span className="text-red-500">*</span></label>
            <input type="text" name="formName" value={form.formName} onChange={handleChange} className={`${inputCls} border-orange-400`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Form Code</label>
            <input type="text" name="formCode" value={form.formCode} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={4} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Created By</label>
            <input type="text" name="createdBy" value={form.createdBy} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className={inputCls}>
              <option value="">-Select-</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Form Type</label>
            <select name="formType" value={form.formType} onChange={handleChange} className={inputCls}>
              <option value="">-Select-</option>
              {FORM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Target Module</label>
            <select name="targetModule" value={form.targetModule} onChange={handleChange} className={inputCls}>
              <option value="">-Select-</option>
              {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Created On</label>
            <input type="date" name="createdOn" value={form.createdOn} onChange={handleChange} className={inputCls} />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
            <Link href="/dashboard/dynamic-forms"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
