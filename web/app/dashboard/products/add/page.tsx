'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addProduct } from '@/hooks/useProducts';
import { useProductCategories } from '@/hooks/useProducts';

export default function AddProductPage() {
  const router = useRouter();
  const { categories } = useProductCategories();

  const [form, setForm] = useState({
    name:        '',
    description: '',
    price:       '',
    sku:         '',
    categoryId:  '',
    taxRate:     '',
    isActive:    true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function handle(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.price) { setError('Name and Price are required.'); return; }
    setSaving(true); setError(null);
    try {
      await addProduct({
        name:        form.name,
        description: form.description || undefined,
        price:       parseFloat(form.price),
        sku:         form.sku || undefined,
        categoryId:  form.categoryId ? parseInt(form.categoryId) : undefined,
        taxRate:     form.taxRate ? parseFloat(form.taxRate) : undefined,
        isActive:    form.isActive,
      });
      router.push('/dashboard/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-semibold text-gray-800">Add Product / Service</h1>
        <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-slate-700">← Back</button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
              <input name="name" value={form.name} onChange={handle} required className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-orange-400" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
              <textarea name="description" value={form.description} onChange={handle} rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-orange-400" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Price (₹) *</label>
              <input name="price" type="number" step="0.01" min="0" value={form.price} onChange={handle} required className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-orange-400" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">SKU</label>
              <input name="sku" value={form.sku} onChange={handle} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-orange-400" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select name="categoryId" value={form.categoryId} onChange={handle} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-orange-400">
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tax Rate (%)</label>
              <input name="taxRate" type="number" step="0.01" min="0" max="100" value={form.taxRate} onChange={handle} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-orange-400" />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" name="isActive" checked={form.isActive} onChange={handle} className="w-4 h-4 accent-orange-500" />
              <label htmlFor="isActive" className="text-xs font-medium text-slate-700">Active</label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Product'}
            </button>
            <button type="button" onClick={() => router.back()} className="px-5 py-2 border border-slate-300 text-sm text-slate-600 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
