'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createDeal, DealStage } from '../../../../src/api/dealsApi';
import { getLeads } from '../../../../src/api/leadsApi';
import { getErrorMessage, reportError, retryAsync } from '@/lib/error-handling';

interface Lead { id: number; name: string; company?: string | null }

const STAGES: DealStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];
const PIPELINES = ['Marketing', 'Service', 'Sales'] as const;

const EMPTY = {
  title:           '',
  value:           '',
  probability:     '',
  stage:           '' as DealStage | '',
  leadId:          '',
  contact:         '',
  closeDate:       '',
  actualCloseDate: '',
  owner:           '',
  pipeline:        '',
};

export default function AddDealPage() {
  const router = useRouter();
  const [form, setForm]           = useState(EMPTY);
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

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

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createDeal({
        title:           form.title,
        value:           parseFloat(form.value),
        probability:     form.probability ? parseFloat(form.probability) : undefined,
        stage:           (form.stage || 'NEW') as DealStage,
        leadId:          form.leadId ? parseInt(form.leadId) : undefined,
        contact:         form.contact         || undefined,
        closeDate:       form.closeDate       || undefined,
        actualCloseDate: form.actualCloseDate || undefined,
        owner:           form.owner           || undefined,
        pipeline:        form.pipeline        || undefined,
      });
      router.push('/dashboard/deals');
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to create deal. Please try again.');
      setError(message);
      reportError(err, 'Deal creation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => setForm(EMPTY);

  const inputCls =
    'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-orange-400 bg-white';
  const labelCls = 'w-44 shrink-0 text-sm text-gray-600 font-medium pt-1.5';

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:py-9">
      <header className="flex items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/dashboard/deals')} className="text-slate-400 transition-colors hover:text-slate-600" aria-label="Back">‹</button>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">New Deal</p>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Add deal</h1>
            <p className="mt-1 text-sm text-slate-500">Capture value, stage, ownership, and close timing.</p>
          </div>
          <Link href="/dashboard/deals/pipeline" className="hidden text-sm font-medium text-slate-500 transition hover:text-slate-900 sm:inline">Pipeline view →</Link>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {error && (
              <p className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Deal Name <span className="text-red-500">*</span></label>
              <input
                required
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Deal Name"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Deal Value</label>
              <input type="number" min="0" step="0.01" value={form.value} onChange={(e) => set('value', e.target.value)} placeholder="#######.##" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Probability</label>
              <input type="number" min="0" max="1" step="0.01" value={form.probability} onChange={(e) => set('probability', e.target.value)} placeholder="0.00" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Stage</label>
              <select value={form.stage} onChange={(e) => set('stage', e.target.value)} className={inputCls}>
                <option value="">-Select-</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Lead</label>
              <select value={form.leadId} onChange={(e) => set('leadId', e.target.value)} className={`${inputCls} focus:border-orange-400`}>
                <option value="">-Select-</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}{l.company ? ` (${l.company})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Contact</label>
              <select value={form.contact} onChange={(e) => set('contact', e.target.value)} className={inputCls}>
                <option value="">-Select-</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.name}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Expected Close Date</label>
              <input type="date" value={form.closeDate} onChange={(e) => set('closeDate', e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Actual Close Date</label>
              <input type="date" value={form.actualCloseDate} onChange={(e) => set('actualCloseDate', e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Owner</label>
              <input type="text" value={form.owner} onChange={(e) => set('owner', e.target.value)} placeholder="Owner name" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Pipeline</label>
              <select value={form.pipeline} onChange={(e) => set('pipeline', e.target.value)} className={inputCls}>
                <option value="">-Select-</option>
                {PIPELINES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={submitting} className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
            <button type="button" onClick={handleReset} className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Reset
            </button>
          </div>
      </form>
    </main>
  );
}
