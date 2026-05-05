'use client';

import { useState } from 'react';
import { Activity, ActivityType, CreateActivityPayload } from '@/api/activitiesApi';
import { addActivity } from '@/hooks/useActivities';

const TYPE_STYLES: Record<ActivityType, { bg: string; text: string; label: string }> = {
  CALL:           { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Call' },
  EMAIL:          { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Email' },
  MEETING:        { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Meeting' },
  NOTE:           { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Note' },
  STATUS_CHANGE:  { bg: 'bg-slate-100',  text: 'text-slate-600',  label: 'Status' },
  DEAL_CREATED:   { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Deal' },
  LEAD_CONVERTED: { bg: 'bg-emerald-100',text: 'text-emerald-700',label: 'Converted' },
  QUOTE_SENT:     { bg: 'bg-cyan-100',   text: 'text-cyan-700',   label: 'Quote' },
  INVOICE_PAID:   { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Paid' },
  TASK_DUE:       { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Task Due' },
};

const ACTIVITY_TYPES: ActivityType[] = ['CALL','EMAIL','MEETING','NOTE','STATUS_CHANGE','DEAL_CREATED','LEAD_CONVERTED','QUOTE_SENT','INVOICE_PAID','TASK_DUE'];

interface Props {
  activities:   Activity[];
  loading:      boolean;
  entityType:   'lead' | 'deal' | 'contact';
  entityId:     number;
  currentUserId?: number;
  onRefetch:    () => void;
}

function fmtTime(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ActivityTimeline({ activities, loading, entityType, entityId, currentUserId = 1, onRefetch }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType]       = useState<ActivityType>('NOTE');
  const [description, setDescription] = useState('');
  const [saving, setSaving]   = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setSaving(true);
    try {
      const payload: CreateActivityPayload = {
        type,
        description: description.trim(),
        userId:      currentUserId,
        ...(entityType === 'lead'    && { leadId:    entityId }),
        ...(entityType === 'deal'    && { dealId:    entityId }),
        ...(entityType === 'contact' && { contactId: entityId }),
      };
      await addActivity(payload);
      setDescription(''); setShowForm(false);
      onRefetch();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="text-xs font-semibold text-slate-700">Activity Timeline</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
        >
          + Log Activity
        </button>
      </div>

      {/* Quick-add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="px-4 py-3 border-b border-slate-100 space-y-2 bg-slate-50">
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ActivityType)}
              className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-orange-400"
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_STYLES[t].label}</option>
              ))}
            </select>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the activity…"
              className="flex-1 text-xs px-2 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-orange-400"
            />
            <button type="submit" disabled={saving} className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50">
              {saving ? '…' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-100">
              ✕
            </button>
          </div>
        </form>
      )}

      {/* Timeline */}
      <div className="p-4">
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-6">Loading activities…</p>
        ) : activities.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No activities yet. Log the first one!</p>
        ) : (
          <ol className="relative border-l border-slate-200 ml-2 space-y-4">
            {activities.map((a) => {
              const style = TYPE_STYLES[a.type] ?? { bg: 'bg-slate-100', text: 'text-slate-600', label: a.type };
              return (
                <li key={a.id} className="ml-4">
                  {/* dot */}
                  <span className={`absolute -left-1.5 w-3 h-3 rounded-full border-2 border-white ${style.bg}`} />
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                    <span className="text-[10px] text-slate-400">{fmtTime(a.createdAt)}</span>
                    <span className="text-[10px] text-slate-400">by {a.user?.name ?? 'System'}</span>
                  </div>
                  <p className="text-xs text-slate-700">{a.description}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
