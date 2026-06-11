'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createTicket, getTicketTypes, TicketType, TicketStatus, CreateTicketPayload } from '../../../../src/api/ticketsApi';
import { getErrorMessage, reportError, retryAsync } from '@/lib/error-handling';

const STATUSES: TicketStatus[] = ['RESERVED', 'SOLD', 'CANCELLED', 'REFUNDED'];

const EMPTY: CreateTicketPayload = {
  event:        '',
  customer:     '',
  price:        undefined,
  status:       'RESERVED',
  purchaseDate: '',
  qrCode:       '',
  notes:        '',
  ticketTypeId: undefined,
};

export default function AddTicketPage() {
  const router = useRouter();
  const [form, setForm]             = useState<CreateTicketPayload>(EMPTY);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    async function loadTicketTypes() {
      try {
        setTicketTypes(await retryAsync(() => getTicketTypes(), 2, 200));
      } catch (error) {
        reportError(error, 'Unable to load ticket types');
      }
    }

    loadTicketTypes();
  }, []);

  function set(field: keyof CreateTicketPayload, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: CreateTicketPayload = {
        event:        form.event        || undefined,
        customer:     form.customer     || undefined,
        price:        form.price        !== undefined && form.price !== null && String(form.price) !== '' ? Number(form.price) : undefined,
        status:       form.status       || 'RESERVED',
        purchaseDate: form.purchaseDate || undefined,
        qrCode:       form.qrCode       || undefined,
        notes:        form.notes        || undefined,
        ticketTypeId: form.ticketTypeId ?? undefined,
      };
      await createTicket(payload);
      router.push('/dashboard/tickets');
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to create ticket');
      setError(message);
      reportError(err, 'Ticket creation failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold text-gray-800">Add Ticket</h1>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        {/* Event */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
          <input
            type="text"
            value={form.event ?? ''}
            onChange={(e) => set('event', e.target.value)}
            placeholder="Event name or code"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>

        {/* Customer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
          <input
            type="text"
            value={form.customer ?? ''}
            onChange={(e) => set('customer', e.target.value)}
            placeholder="Customer name"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>

        {/* Ticket Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Type</label>
          <select
            value={form.ticketTypeId ?? ''}
            onChange={(e) => set('ticketTypeId', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-orange-400 bg-white"
          >
            <option value="">-Select-</option>
            {ticketTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.price ?? ''}
            onChange={(e) => set('price', e.target.value === '' ? undefined : parseFloat(e.target.value))}
            placeholder="0.00"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={form.status ?? 'RESERVED'}
            onChange={(e) => set('status', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-orange-400 bg-white"
          >
            <option value="">-Select-</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>

        {/* Purchase Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
          <input
            type="date"
            value={form.purchaseDate ?? ''}
            onChange={(e) => set('purchaseDate', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>

        {/* QR Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">QR Code</label>
          <input
            type="url"
            value={form.qrCode ?? ''}
            onChange={(e) => set('qrCode', e.target.value)}
            placeholder="https://"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            placeholder="Additional notes…"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-orange-400 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Submit'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
