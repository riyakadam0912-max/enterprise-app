'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCampaignLead } from '@/api/campaignLeadsApi';
import { getLeads, Lead } from '@/api/leadsApi';
import { getErrorMessage, reportError, retryAsync } from '@/lib/error-handling';

const SOURCE_TYPES = ['Page Visit', 'Click', 'Email Open', 'Form Submission'];
const STATUS_OPTIONS = ['New', 'Engaged', 'Qualified'];

const EMPTY_FORM = {
  campaign: '',
  leadId: '',
  engagementScore: '',
  sourceType: '',
  lastInteraction: '',
  status: '',
  notes: '',
};

export default function AddCampaignLeadPage() {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLeads() {
      try {
        setLeads(await retryAsync(() => getLeads(), 2, 200));
      } catch (error) {
        reportError(error, 'Unable to load leads');
      }
    }

    loadLeads();
  }, []);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createCampaignLead({
        campaign: form.campaign,
        leadId: form.leadId ? parseInt(form.leadId) : undefined,
        engagementScore: form.engagementScore ? parseInt(form.engagementScore) : undefined,
        sourceType: form.sourceType || undefined,
        lastInteraction: form.lastInteraction || undefined,
        status: form.status || undefined,
        notes: form.notes || undefined,
      });
      router.push('/dashboard/campaign-leads');
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to save campaign lead');
      setError(message);
      reportError(err, 'Campaign lead creation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({ ...EMPTY_FORM });
    setError(null);
  };

  const fieldClass = 'w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1 w-40 shrink-0 pt-2';

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-800 mb-6">Campaign Leads</h1>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm max-w-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Campaign */}
          <div className="flex items-start gap-4">
            <label className={labelClass}>Campaign</label>
            <div className="flex-1">
              <input
                type="text"
                value={form.campaign}
                onChange={(e) => set('campaign', e.target.value)}
                required
                autoFocus
                className={`${fieldClass} border-orange-400 focus:ring-orange-500`}
              />
            </div>
          </div>

          {/* Lead */}
          <div className="flex items-start gap-4">
            <label className={labelClass}>Lead</label>
            <div className="flex-1">
              <select
                value={form.leadId}
                onChange={(e) => set('leadId', e.target.value)}
                className={fieldClass}
              >
                <option value="">-Select-</option>
                {leads.map((l) => (
                  <option key={l.id} value={String(l.id)}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Engagement Score */}
          <div className="flex items-start gap-4">
            <label className={labelClass}>Engagement Score</label>
            <div className="flex-1">
              <input
                type="number"
                min="0"
                max="100"
                value={form.engagementScore}
                onChange={(e) => set('engagementScore', e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          {/* Source Type */}
          <div className="flex items-start gap-4">
            <label className={labelClass}>Source Type</label>
            <div className="flex-1">
              <select
                value={form.sourceType}
                onChange={(e) => set('sourceType', e.target.value)}
                className={fieldClass}
              >
                <option value="">-Select-</option>
                {SOURCE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Last Interaction */}
          <div className="flex items-start gap-4">
            <label className={labelClass}>Last Interaction</label>
            <div className="flex-1">
              <input
                type="datetime-local"
                value={form.lastInteraction}
                onChange={(e) => set('lastInteraction', e.target.value)}
                className={fieldClass}
                placeholder="dd-MMM-yyyy HH:mm:ss"
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
                <option value="">-Select-</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
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

          {error && <p className="text-red-500 text-sm ml-44">{error}</p>}

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2 ml-44">
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
    </div>
  );
}
