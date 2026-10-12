'use client';

import { useState, type FormEvent } from 'react';
import { createProduct, type ProductInput } from '@/api/productsApi';
import type { Product } from '@/types/entities';

const UNIT_OPTIONS = ['Piece', 'Unit', 'Box', 'Pack', 'Set', 'Hour', 'Day', 'Week', 'Month', 'Kilogram', 'Gram', 'Liter', 'Meter', 'Square meter'];

interface ServiceCreateFormProps {
  onCreated: (product: Product) => void;
  onCancel: () => void;
}

export function ServiceCreateForm({ onCreated, onCancel }: ServiceCreateFormProps) {
  const [form, setForm] = useState<ProductInput>({ name: '', description: '', unit: 'Unit', type: 'SERVICE', price: 0, sku: '', taxRate: 0, isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitQuery, setUnitQuery] = useState('');

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
        <label className="relative space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Units</span><input required value={form.unit ?? ''} onChange={(event) => { setUnitQuery(event.target.value); setField('unit', event.target.value); }} placeholder="Search units" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400" />{unitQuery ? <div className="absolute left-0 right-0 top-full z-10 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">{UNIT_OPTIONS.filter((unit) => unit.toLowerCase().includes(unitQuery.toLowerCase())).map((unit) => <button type="button" key={unit} onClick={() => { setUnitQuery(''); setField('unit', unit); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50">{unit}</button>)}</div> : null}</label>
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
