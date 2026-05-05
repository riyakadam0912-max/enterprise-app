'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getTicketsByType,
  createTicketType,
  deleteTicketType,
  TicketTypeWithTickets,
  Ticket,
} from '../../../../src/api/ticketsApi';
import { formatInrCurrency } from '@/utils/formatCurrency';

const TYPE_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
];

function fmtPrice(n: number | null) {
  if (n === null) return '—';
  return formatInrCurrency(n, 2);
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm mb-2 text-xs text-gray-700 space-y-1">
      {ticket.event && <p className="font-semibold text-gray-800">{ticket.event}</p>}
      {ticket.customer && <p className="text-gray-500">{ticket.customer}</p>}
      <div className="flex items-center justify-between pt-1">
        <span className="font-medium">{fmtPrice(ticket.price)}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
          ticket.status === 'SOLD'      ? 'bg-green-100 text-green-700' :
          ticket.status === 'RESERVED'  ? 'bg-blue-100 text-blue-700' :
          ticket.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                                          'bg-yellow-100 text-yellow-700'
        }`}>
          {ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
        </span>
      </div>
    </div>
  );
}

export default function TicketTypesPage() {
  const router = useRouter();
  const [groups, setGroups]     = useState<TicketTypeWithTickets[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName]   = useState('');
  const [newColor, setNewColor] = useState(TYPE_COLORS[0]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setGroups(await getTicketsByType()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleAddType(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createTicketType({ name: newName.trim(), color: newColor });
      setNewName('');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create type');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteType(id: number, name: string) {
    if (!confirm(`Delete ticket type "${name}"? Tickets using this type will be unlinked.`)) return;
    try {
      await deleteTicketType(id);
      await load();
    } catch {
      alert('Failed to delete ticket type.');
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-800">Ticket Types</h1>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          + Add Type
        </button>
      </div>

      {/* Add Type Form */}
      {showForm && (
        <form
          onSubmit={handleAddType}
          className="mb-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. VIP"
              required
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-orange-400 w-48"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
            <div className="flex items-center gap-1.5">
              {TYPE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${newColor === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewName(''); }}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Kanban columns */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-4xl mb-3">🎫</span>
          <p className="text-sm font-medium">No ticket types yet</p>
          <p className="text-xs mt-1">Click <strong>+ Add Type</strong> to create one</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {groups.map((group) => (
            <div key={group.id} className="shrink-0 w-64">
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2 rounded-t-lg text-white text-sm font-semibold"
                style={{ backgroundColor: group.color ?? '#6366f1' }}
              >
                <span>{group.name}</span>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="text-xs">{group.tickets.length}</span>
                  <button
                    onClick={() => handleDeleteType(group.id, group.name)}
                    className="hover:text-white transition-colors text-xs leading-none"
                    title="Delete type"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Cards */}
              <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg p-2 min-h-30">
                {group.tickets.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-6">No Records</p>
                ) : (
                  group.tickets.map((ticket) => (
                    <TicketCard key={ticket.id} ticket={ticket} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
