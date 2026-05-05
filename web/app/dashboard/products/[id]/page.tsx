'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useProduct, useProductCategories, editProduct, removeProduct } from '@/hooks/useProducts';
import { formatInrCurrency } from '@/utils/formatCurrency';

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = parseInt(params.id as string);
  const { product, loading, error } = useProduct(id);
  const { categories } = useProductCategories();

  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', description: '', price: '', sku: '', categoryId: '', taxRate: '', isActive: true,
  });

  useEffect(() => {
    if (product) {
      setForm({
        name:        product.name,
        description: product.description ?? '',
        price:       String(product.price),
        sku:         product.sku ?? '',
        categoryId:  product.categoryId != null ? String(product.categoryId) : '',
        taxRate:     product.taxRate != null ? String(product.taxRate) : '',
        isActive:    product.isActive,
      });
    }
  }, [product]);

  function handle(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveErr(null);
    try {
      await editProduct(id, {
        name:        form.name,
        description: form.description || undefined,
        price:       parseFloat(form.price),
        sku:         form.sku || undefined,
        categoryId:  form.categoryId ? parseInt(form.categoryId) : undefined,
        taxRate:     form.taxRate ? parseFloat(form.taxRate) : undefined,
        isActive:    form.isActive,
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this product?')) return;
    setDeleting(true);
    try { await removeProduct(id); router.push('/dashboard/products'); }
    finally { setDeleting(false); }
  }

  if (loading) return <div className="p-6 text-slate-400">Loading…</div>;
  if (error || !product) return <div className="p-6 text-red-500">{error ?? 'Product not found'}</div>;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-semibold text-gray-800">{product.name}</h1>
        <div className="flex items-center gap-2">
          {!editing && (
            <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
              Edit
            </button>
          )}
          <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs border border-red-300 text-red-600 hover:bg-red-50 rounded-lg font-semibold disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-slate-700">← Back</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        {!editing ? (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Name',        product.name],
              ['SKU',         product.sku ?? '—'],
              ['Price',       formatInrCurrency(product.price)],
              ['Tax Rate',    product.taxRate != null ? `${product.taxRate}%` : '—'],
              ['Category',    product.category?.name ?? '—'],
              ['Status',      product.isActive ? 'Active' : 'Inactive'],
              ['Description', product.description ?? '—'],
              ['Created',     new Date(product.createdAt).toLocaleDateString()],
            ].map(([label, val]) => (
              <div key={label} className={label === 'Description' ? 'col-span-2' : ''}>
                <dt className="text-xs text-slate-500 mb-0.5">{label}</dt>
                <dd className="font-medium text-slate-800">{val}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {saveErr && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">{saveErr}</div>}

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
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <button type="submit" disabled={saving} className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="px-5 py-2 border border-slate-300 text-sm text-slate-600 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
