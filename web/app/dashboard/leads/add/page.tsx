'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addLead } from '@/hooks/useLeads';

const SOURCES  = ['Direct', 'Website', 'Event', 'Referral', 'Social Media', 'Other'];
const STATUSES = ['New', 'Contacted', 'Closed Won', 'Closed Lost', 'Proposal Sent', 'Qualified'];

export default function AddLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const [form, setForm] = useState({
    name:          '',
    source:        '',
    status:        '',
    leadOwner:     '',
    contactedDate: '',
    nextFollowUp:  '',
    assignedTo:    '',
    leadScore:     '',
    notes:         '',
    createdBy:     '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleReset() {
    setForm({ name: '', source: '', status: '', leadOwner: '', contactedDate: '', nextFollowUp: '', assignedTo: '', leadScore: '', notes: '', createdBy: '' });
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Lead Name is required.'); return; }
    setLoading(true);
    try {
      await addLead({
        name:          form.name.trim(),
        source:        form.source        || undefined,
        status:        form.status        || undefined,
        leadOwner:     form.leadOwner.trim()  || undefined,
        contactedDate: form.contactedDate || undefined,
        nextFollowUp:  form.nextFollowUp  || undefined,
        assignedTo:    form.assignedTo.trim()   || undefined,
        leadScore:     form.leadScore ? Number(form.leadScore) : undefined,
        notes:         form.notes.trim()     || undefined,
        createdBy:     form.createdBy.trim() || undefined,
      });
      router.push('/dashboard/leads');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm';

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/leads" className="text-slate-400 transition-colors hover:text-slate-600" aria-label="Back">←</Link>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">New Lead</p>
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Capture the next opportunity cleanly</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Use this form to capture enough context for follow-up, scoring, and assignment without making the user think like an admin.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capture</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Source + owner</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qualify</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Score + status</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next step</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Follow-up date</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Lead Name <span className="text-red-500">*</span></label>
                <input type="text" name="name" value={form.name} onChange={handleChange} className={`${inputCls} border-orange-400`} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Source</label>
                <select name="source" value={form.source} onChange={handleChange} className={inputCls}>
                  <option value="">-Select-</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select name="status" value={form.status} onChange={handleChange} className={inputCls}>
                  <option value="">-Select-</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Lead Owner</label>
                <input type="text" name="leadOwner" value={form.leadOwner} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Assigned To</label>
                <input type="text" name="assignedTo" value={form.assignedTo} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Created By</label>
                <input type="text" name="createdBy" value={form.createdBy} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Contacted Date</label>
                <input type="date" name="contactedDate" value={form.contactedDate} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Next Follow Up</label>
                <input type="date" name="nextFollowUp" value={form.nextFollowUp} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Lead Score</label>
                <input type="number" name="leadScore" value={form.leadScore} onChange={handleChange} min={0} max={100} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={5} className={`${inputCls} resize-none`} />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button type="submit" disabled={loading} className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-60">
                {loading ? 'Submitting…' : 'Submit'}
              </button>
              <button type="button" onClick={handleReset} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                Reset
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Why this matters</p>
            <p className="mt-2 text-sm text-slate-500">A better lead capture form speeds qualification, keeps ownership clear, and gives the follow-up queue enough signal to work like a CRM.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Recommended data</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Source: where the lead came from.</li>
              <li>Status: the current stage of qualification.</li>
              <li>Next follow-up: when the owner should act next.</li>
              <li>Lead score: priority signal for the sales team.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
