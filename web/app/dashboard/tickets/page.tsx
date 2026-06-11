'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTickets, deleteTicket, Ticket, TicketStatus } from '../../../src/api/ticketsApi';
import TableActions from '@/components/common/TableActions';
import { formatInrCurrency } from '@/utils/formatCurrency';
import { reportError } from '@/lib/error-handling';

const STATUS_COLOR: Record<TicketStatus, string> = {
  RESERVED:  'bg-blue-100 text-blue-700',
  SOLD:      'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED:  'bg-yellow-100 text-yellow-700',
};

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtPrice(n: number | null) {
  if (n === null) return '—';
  return formatInrCurrency(n, 2);
}

export default function AllTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets]   = useState<Ticket[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    async function loadTickets() {
      try {
        setTickets(await getTickets());
      } catch (error) {
        reportError(error, 'Unable to load tickets');
      } finally {
        setLoading(false);
      }
    }

    loadTickets();
  }, []);

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    return (
      (t.event    ?? '').toLowerCase().includes(q) ||
      (t.customer ?? '').toLowerCase().includes(q) ||
      (t.ticketType?.name ?? '').toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q)
    );
  });

  async function handleDelete(id: number) {
    if (!confirm('Delete this ticket?')) return;
    setDeleteId(id);
    try {
      await deleteTicket(id);
      setTickets((prev) => prev.filter((t) => t.id !== id));
    } catch {
      alert('Failed to delete ticket.');
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-800">All Tickets</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded outline-none focus:ring-1 focus:ring-orange-400 w-56"
          />
          <button
            onClick={() => router.push('/dashboard/tickets/add')}
            className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            + Add Ticket
          </button>
          <button
            onClick={() => router.push('/dashboard/tickets/ticket-types')}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
          >
            Ticket Types
          </button>
          <TableActions
            moduleKey="tickets"
            rows={filtered}
            onRefresh={async () => {
              try {
                setTickets(await getTickets());
              } catch (error) {
                reportError(error, 'Unable to refresh tickets');
              }
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="text-4xl mb-3">🎫</span>
            <p className="text-sm font-medium">No tickets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Event', 'Customer', 'Ticket Type', 'Price', 'Status', 'Purchase Date', 'QR Code', 'Notes', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{ticket.event ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{ticket.customer ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ticket.ticketType ? (
                        <span
                          className="inline-block px-2.5 py-1 rounded text-xs font-semibold text-white"
                          style={{ backgroundColor: ticket.ticketType.color ?? '#6366f1' }}
                        >
                          {ticket.ticketType.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtPrice(ticket.price)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[ticket.status as TicketStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(ticket.purchaseDate)}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-40 truncate">
                      {ticket.qrCode ? (
                        <a href={ticket.qrCode} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate block max-w-35">
                          {ticket.qrCode}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-50 truncate">{ticket.notes ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/tickets/${ticket.id}/edit`)}
                          className="text-xs text-gray-500 hover:text-orange-500 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(ticket.id)}
                          disabled={deleteId === ticket.id}
                          className="text-xs text-gray-500 hover:text-red-500 transition-colors disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!loading && (
        <p className="mt-3 text-xs text-gray-400">
          Showing {filtered.length} of {tickets.length}
        </p>
      )}
    </div>
  );
}
