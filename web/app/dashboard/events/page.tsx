'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getEvents, deleteEvent, Event } from '@/api/eventsApi';
import TableActions from '@/components/common/TableActions';

function fmtDateTime(d: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  const date = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  const time = dt.toTimeString().slice(0, 8);
  return `${date} ${time}`;
}

export default function AllEventsPage() {
  const router = useRouter();
  const [events,  setEvents]  = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents().then(setEvents).finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    if (!confirm('Delete this event?')) return;
    await deleteEvent(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">All Events</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard/events/add')}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Add Event
          </button>
          <TableActions moduleKey="events" rows={events} onRefresh={() => getEvents().then(setEvents)} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Event Name','Event Code','Start Date Time','End Date Time','Location','Organizer','Status','Capacity','Description',''].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No events found</td></tr>
            ) : events.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{e.eventName}</td>
                <td className="px-4 py-3 text-orange-500 whitespace-nowrap">{e.eventCode ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDateTime(e.startDateTime)}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDateTime(e.endDateTime)}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {e.location ? (
                    <span className="flex items-center gap-1">
                      <span className="text-orange-500">📍</span>
                      {e.location}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{e.organizer ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{e.status ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700 text-right whitespace-nowrap">{e.capacity ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{e.description ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex gap-2">
                    <Link href={`/dashboard/events/${e.id}/edit`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                    <button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
          Showing {events.length} of {events.length}
        </div>
      </div>
    </div>
  );
}
