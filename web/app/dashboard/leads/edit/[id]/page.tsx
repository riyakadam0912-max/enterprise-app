'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useLead, editLead } from '@/hooks/useLeads';

const SOURCES  = ['Direct', 'Website', 'Event', 'Referral', 'Social Media', 'Other'];
const STATUSES = ['New', 'Contacted', 'Closed Won', 'Closed Lost', 'Proposal Sent', 'Qualified'];

export default function EditLeadPage() {
  const params = useParams();
  const id = Number(params.id);
  const router = useRouter();

  const { lead, loading: fetching, error: fetchError } = useLead(id);

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lead) {
      setForm({
        name:          lead.name          ?? '',
        source:        lead.source        ?? '',
        status:        lead.status        ?? '',
        leadOwner:     lead.leadOwner     ?? '',
        contactedDate: lead.contactedDate ? lead.contactedDate.slice(0, 10) : '',
        nextFollowUp:  lead.nextFollowUp  ? lead.nextFollowUp.slice(0, 10)  : '',
        assignedTo:    lead.assignedTo    ?? '',
        leadScore:     lead.leadScore != null ? String(lead.leadScore) : '',
        notes:         lead.notes         ?? '',
        createdBy:     lead.createdBy     ?? '',
      });
    }
  }, [lead]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Lead Name is required.'); return; }
    setSaving(true);
    try {
      await editLead(id, {
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
      setError(err instanceof Error ? err.message : 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm';

  if (fetching) return <div className="p-6 text-slate-400">Loading…</div>;
  if (fetchError) return <div className="p-6 text-red-500">{fetchError}</div>;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/leads" className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Back">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Lead</h1>
          <p className="text-sm text-slate-500 mt-0.5">Update lead details</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lead Name <span className="text-red-500">*</span></label>
            <input type="text" name="name" value={form.name} onChange={handleChange} className={`${inputCls} border-orange-400`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
            <select name="source" value={form.source} onChange={handleChange} className={inputCls}>
              <option value="">-Select-</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className={inputCls}>
              <option value="">-Select-</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lead Owner</label>
            <input type="text" name="leadOwner" value={form.leadOwner} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contacted Date</label>
            <input type="date" name="contactedDate" value={form.contactedDate} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Next Follow Up</label>
            <input type="date" name="nextFollowUp" value={form.nextFollowUp} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assigned To</label>
            <input type="text" name="assignedTo" value={form.assignedTo} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lead Score</label>
            <input type="number" name="leadScore" value={form.leadScore} onChange={handleChange} min={0} max={100} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Created By</label>
            <input type="text" name="createdBy" value={form.createdBy} onChange={handleChange} className={inputCls} />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <Link href="/dashboard/leads"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
