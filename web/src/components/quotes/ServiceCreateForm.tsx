'use client';

import { useState, type FormEvent } from 'react';
import { createProduct, type ProductInput } from '@/api/productsApi';
import type { Product } from '@/types/entities';

const UNIT_OPTIONS = [
  'None',
  'box',
  'cm',
  'dz',
  'ft',
  'g',
  'in',
  'kg',
  'km',
  'mg',
  'ml',
  'm',
  'pcs',
  'Day',
  'Design',
  'service',
  'qty',
  'Reel',
  'SETUP',
  'Per Month',
  'Per Min',
  'Per Presentation',
  'Per Product',
  'Per Page',
  'Per Day',
  'Lifetime',
  'Per Package',
  'Per Event',
  'Per Project',
  'Project',
];

interface ServiceCreateFormProps {
  availableUnits?: string[];
  onCreated: (product: Product) => void;
  onCancel: () => void;
}

export function ServiceCreateForm({ availableUnits = [], onCreated, onCancel }: ServiceCreateFormProps) {
  const [form, setForm] = useState<ProductInput>({ name: '', description: '', unit: 'None', type: 'SERVICE', price: 0, sku: '', taxRate: 0, isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitQuery, setUnitQuery] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const unitOptions = Array.from(new Set([...UNIT_OPTIONS, ...availableUnits]));

  function setField<K extends keyof ProductInput>(field: K, value: ProductInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createProduct({ ...form, name: form.name.trim(), price: Number(form.price), taxRate: Number(form.taxRate) });
      setUnitQuery('');
      onCreated(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create service.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Create service form">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service name</span><input required value={form.name} onChange={(event) => setField('name', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400" /></label>
        <label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">SKU</span><input value={form.sku ?? ''} onChange={(event) => setField('sku', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400" /></label>
        <div className="relative space-y-1 text-sm">
          <label htmlFor="service-unit-trigger" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</label>
          <button id="service-unit-trigger" type="button" aria-haspopup="listbox" aria-expanded={unitPickerOpen} onClick={() => { setUnitPickerOpen((open) => !open); setUnitQuery(''); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left outline-none focus:border-orange-400">
            {form.unit || 'Select a unit'}
          </button>
          {unitPickerOpen ? <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            <input autoFocus value={unitQuery} onChange={(event) => setUnitQuery(event.target.value)} placeholder="Search units" aria-label="Search units" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-orange-400" />
            <div role="listbox" aria-label="Units" className="mt-2 max-h-52 overflow-y-auto">
              {unitOptions.filter((unit) => unit.toLowerCase().includes(unitQuery.trim().toLowerCase())).map((unit) => <button type="button" role="option" aria-selected={form.unit === unit} key={unit} onClick={() => { setField('unit', unit); setUnitQuery(''); setUnitPickerOpen(false); }} className="block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-orange-50">{unit}{form.unit === unit ? <span className="float-right text-orange-600">✓</span> : null}</button>)}
              {unitOptions.every((unit) => !unit.toLowerCase().includes(unitQuery.trim().toLowerCase())) ? <p className="px-3 py-3 text-sm text-slate-500">No matching units.</p> : null}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); const value = customUnit.trim(); if (!value) return; const existing = unitOptions.find((unit) => unit.toLowerCase() === value.toLowerCase()); setField('unit', existing ?? value); setCustomUnit(''); setUnitQuery(''); setUnitPickerOpen(false); }} className="mt-2 flex gap-2 border-t border-slate-200 pt-2">
              <input value={customUnit} onChange={(event) => setCustomUnit(event.target.value)} placeholder="Tap to Add" aria-label="Custom unit" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-orange-400" />
              <button type="submit" disabled={!customUnit.trim()} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Add</button>
            </form>
          </div> : null}
        </div>
        <label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span><select value={form.type ?? 'SERVICE'} onChange={(event) => setField('type', event.target.value as ProductInput['type'])} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400"><option value="GOODS">Goods</option><option value="SERVICE">Services</option></select></label>
        <label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rate</span><input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => setField('price', Number(event.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400" /></label>
        <label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tax rate %</span><input type="number" min="0" step="0.01" value={form.taxRate ?? 0} onChange={(event) => setField('taxRate', Number(event.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400" /></label>
      </div>
      <label className="block space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span><textarea rows={3} value={form.description ?? ''} onChange={(event) => setField('description', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400" /></label>
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
      <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? 'Creating...' : 'Create service'}</button></div>
    </form>
  );
}
