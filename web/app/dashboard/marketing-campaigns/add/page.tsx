'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createMarketingCampaign } from '@/api/marketingCampaignsApi';

const CHANNELS = ['Email', 'Social Media', 'Website', 'Event', 'Direct Mail'];
const STATUSES = ['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED'];

const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400';

export default function AddMarketingCampaignPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    campaignName:   '',
    channel:        '',
    startDate:      '',
    endDate:        '',
    objective:      '',
    budget:         '',
    status:         '',
    targetAudience: '',
    createdBy:      '',
    campaignOwner:  '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(key: keyof typeof form, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.campaignName.trim()) { setError('Campaign Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await createMarketingCampaign({
        campaignName:   form.campaignName.trim(),
        channel:        form.channel        || undefined,
        startDate:      form.startDate      || undefined,
        endDate:        form.endDate        || undefined,
        objective:      form.objective.trim()      || undefined,
        budget:         form.budget ? parseFloat(form.budget) : undefined,
        status:         form.status         || undefined,
        targetAudience: form.targetAudience.trim() || undefined,
        createdBy:      form.createdBy.trim()      || undefined,
        campaignOwner:  form.campaignOwner.trim()  || undefined,
      });
      router.push('/dashboard/marketing-campaigns');
    } catch {
      setError('Failed to create campaign. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Marketing Campaigns</h1>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

        {/* Campaign Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
          <input
            className={`${field} border-orange-400`}
            value={form.campaignName}
            onChange={(e) => set('campaignName', e.target.value)}
            placeholder="Enter campaign name"
          />
        </div>

        {/* Channel */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
          <select className={field} value={form.channel} onChange={(e) => set('channel', e.target.value)}>
            <option value="">-Select-</option>
            {CHANNELS.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
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

        {/* Objective */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Objective</label>
          <input className={field} value={form.objective} onChange={(e) => set('objective', e.target.value)} placeholder="Campaign objective" />
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={field}
            value={form.budget}
            onChange={(e) => set('budget', e.target.value)}
            placeholder="#######.##"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select className={field} value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">-Select-</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
          <input className={field} value={form.targetAudience} onChange={(e) => set('targetAudience', e.target.value)} placeholder="e.g. Millennials" />
        </div>

        {/* Created By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
          <input className={field} value={form.createdBy} onChange={(e) => set('createdBy', e.target.value)} placeholder="Creator name" />
        </div>

        {/* Campaign Owner */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Owner</label>
          <input className={field} value={form.campaignOwner} onChange={(e) => set('campaignOwner', e.target.value)} placeholder="Owner name" />
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
            onClick={() => setForm({ campaignName:'', channel:'', startDate:'', endDate:'', objective:'', budget:'', status:'', targetAudience:'', createdBy:'', campaignOwner:'' })}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
