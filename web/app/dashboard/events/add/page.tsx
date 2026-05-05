'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createEvent } from '@/api/eventsApi';

const STATUSES    = ['Planned', 'Completed', 'Cancelled', 'In Progress'];
const EVENT_TYPES = ['Training', 'Networking', 'Webinar', 'Workshop', 'Conference', 'Other'];

const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400';

export default function AddEventPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    eventName:     '',
    eventCode:     '',
    startDateTime: '',
    endDateTime:   '',
    location:      '',
    organizer:     '',
    status:        '',
    capacity:      '',
    description:   '',
    eventType:     '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(key: keyof typeof form, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.eventName.trim()) { setError('Event Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await createEvent({
        eventName:     form.eventName.trim(),
        eventCode:     form.eventCode.trim()   || null,
        startDateTime: form.startDateTime      || null,
        endDateTime:   form.endDateTime        || null,
        location:      form.location.trim()    || null,
        organizer:     form.organizer.trim()   || null,
        status:        form.status             || null,
        capacity:      form.capacity ? parseInt(form.capacity, 10) : null,
        description:   form.description.trim() || null,
        eventType:     form.eventType          || null,
      });
      router.push('/dashboard/events');
    } catch {
      setError('Failed to create event. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Events</h1>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

        {/* Event Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
          <input
            className={field}
            value={form.eventName}
            onChange={(e) => set('eventName', e.target.value)}
            placeholder="Enter event name"
          />
        </div>

        {/* Event Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Code</label>
          <input
            className={field}
            value={form.eventCode}
            onChange={(e) => set('eventCode', e.target.value)}
            placeholder="e.g. ACR20260224"
          />
        </div>

        {/* Start Date Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date Time</label>
          <input
            type="datetime-local"
            className={field}
            value={form.startDateTime}
            onChange={(e) => set('startDateTime', e.target.value)}
          />
        </div>

        {/* End Date Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date Time</label>
          <input
            type="datetime-local"
            className={field}
            value={form.endDateTime}
            onChange={(e) => set('endDateTime', e.target.value)}
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input
            className={field}
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Address Line 1"
          />
        </div>

        {/* Organizer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Organizer</label>
          <input
            className={field}
            value={form.organizer}
            onChange={(e) => set('organizer', e.target.value)}
            placeholder="Organizer name"
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

        {/* Capacity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
          <input
            type="number"
            min="0"
            className={field}
            value={form.capacity}
            onChange={(e) => set('capacity', e.target.value)}
            placeholder="#######"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={4}
            className={field}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Event description"
          />
        </div>

        {/* Event Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
          <select className={field} value={form.eventType} onChange={(e) => set('eventType', e.target.value)}>
            <option value="">-Select-</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
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
            onClick={() => setForm({ eventName:'', eventCode:'', startDateTime:'', endDateTime:'', location:'', organizer:'', status:'', capacity:'', description:'', eventType:'' })}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
