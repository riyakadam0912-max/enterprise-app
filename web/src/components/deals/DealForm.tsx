'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Deal, DealStage, CreateDealPayload } from '../../api/dealsApi';
import { getLeads } from '../../api/leadsApi';
import { getEmployees } from '../../api/employeesApi';

const STAGES: DealStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

interface Lead     { id: number; name: string; company?: string | null }
interface Employee { id: number; name: string }

interface DealFormProps {
  /** Prefilled data for edit mode */
  initial?: Deal;
  onSubmit: (data: CreateDealPayload) => Promise<void>;
  submitting: boolean;
  error: string | null;
}

export default function DealForm({ initial, onSubmit, submitting, error }: DealFormProps) {
  const router = useRouter();

  const [form, setForm] = useState({
    title:       initial?.title                                                 ?? '',
    value:       String(initial?.value                                          ?? ''),
    stage:       (initial?.stage                                                ?? 'NEW') as DealStage,
    probability: initial?.probability != null ? String(initial.probability * 100) : '',
    closeDate:   initial?.closeDate ? initial.closeDate.split('T')[0]           : '',
    leadId:      String(initial?.leadId                                         ?? ''),
    employeeId:  String(initial?.employeeId                                     ?? ''),
  });
  const [leads,     setLeads]     = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    getLeads().then(setLeads).catch(() => {});
    getEmployees().then(setEmployees).catch(() => {});
  }, []);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateDealPayload = {
      title:       form.title,
      value:       parseFloat(form.value),
      stage:       form.stage,
      probability: form.probability ? parseFloat(form.probability) / 100 : undefined,
      closeDate:   form.closeDate   || undefined,
      leadId:      form.leadId      ? parseInt(form.leadId)      : undefined,
      employeeId:  form.employeeId  ? parseInt(form.employeeId)  : undefined,
    };
    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5 max-w-xl">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          required
          type="text"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>

      {/* Value + Stage */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Deal Value (₹) <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.value}
            onChange={(e) => set('value', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-600 mb-1">Stage</label>
          <select
            value={form.stage}
            onChange={(e) => set('stage', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Probability + Close Date */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Probability (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            placeholder="e.g. 75"
            value={form.probability}
            onChange={(e) => set('probability', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-600 mb-1">Close Date</label>
          <input
            type="date"
            value={form.closeDate}
            onChange={(e) => set('closeDate', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
      </div>

      {/* Lead */}
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">Lead</label>
        <select
          value={form.leadId}
          onChange={(e) => set('leadId', e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
        >
          <option value="">— No lead —</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}{l.company ? ` (${l.company})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Owner (Employee) */}
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">Owner</label>
        <select
          value={form.employeeId}
          onChange={(e) => set('employeeId', e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
        >
          <option value="">— No owner —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving…' : initial ? 'Update Deal' : 'Create Deal'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border border-slate-200 text-slate-600 text-sm px-5 py-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
