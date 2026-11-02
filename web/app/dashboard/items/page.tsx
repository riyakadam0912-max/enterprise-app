'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProduct, getProducts } from '@/api/productsApi';
import type { Product } from '@/types/entities';
import { ServiceCreateForm } from '@/components/quotes/ServiceCreateForm';
import { useAuth } from '@/providers/AuthProvider';

export default function ItemsPage() {
  const router = useRouter();
  const { authenticated, loading: authLoading, session } = useAuth();
  const canManageItems = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN' || session.isSuperAdmin || session.isPlatformAdmin;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !authenticated) return;
    if (!canManageItems) {
      router.replace('/dashboard');
      return;
    }

    let active = true;
    getProducts()
      .then((items) => {
        if (active) setProducts(items);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load catalog items.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, authenticated, canManageItems, router]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) =>
      [product.name, product.sku].some((value) => value?.toLowerCase().includes(normalized)),
    );
  }, [products, query]);

  function closeForm() {
    setFormOpen(false);
    setEditingProduct(null);
  }

  function handleCreated(product: Product) {
    setProducts((current) => [product, ...current]);
    setNotice(`${product.name} added to the catalog.`);
    setError(null);
    closeForm();
  }

  function handleUpdated(product: Product) {
    setProducts((current) => current.map((item) => item.id === product.id ? product : item));
    setNotice(`${product.name} updated.`);
    setError(null);
    closeForm();
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Delete "${product.name}"? It will no longer be available for new quotes and invoices.`)) return;

    setDeletingId(product.id);
    setError(null);
    setNotice(null);
    try {
      await deleteProduct(product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setNotice(`${product.name} removed from the catalog.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete this item.');
    } finally {
      setDeletingId(null);
    }
  }

  if (!canManageItems) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">You do not have permission to manage catalog items.</div>;
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Items</h1>
          <p className="mt-1 text-sm text-slate-500">Manage the goods and services available when creating quotes and invoices.</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingProduct(null); setFormOpen(true); setNotice(null); }}
          className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          + Add item
        </button>
      </header>

      {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-semibold text-slate-900">Catalog</h2>
            <p className="mt-0.5 text-xs text-slate-500">{products.length} {products.length === 1 ? 'item' : 'items'}</p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search items or SKU"
            aria-label="Search catalog items"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-orange-400 sm:max-w-xs"
          />
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading catalog…</p>
        ) : filteredProducts.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{query ? 'No items match your search.' : 'No catalog items yet. Add an item to use it in quotes and invoices.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Unit</th>
                  <th className="px-4 py-3 text-right font-semibold">Rate</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{product.name}</p>
                      {product.sku ? <p className="mt-0.5 text-xs text-slate-500">SKU {product.sku}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{product.type === 'GOODS' ? 'Goods' : 'Service'}</td>
                    <td className="px-4 py-3 text-slate-600">{product.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{product.price.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${product.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => { setEditingProduct(product); setFormOpen(true); setNotice(null); }}
                          className="text-sm font-medium text-orange-600 hover:text-orange-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product)}
                          disabled={deletingId !== null}
                          className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === product.id ? 'Deleting…' : 'Delete'}
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

      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="catalog-form-title" className="max-h-[min(760px,calc(100vh-2rem))] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="catalog-form-title" className="text-lg font-semibold text-slate-900">{editingProduct ? 'Edit catalog item' : 'Add catalog item'}</h2>
                <p className="mt-1 text-sm text-slate-500">This item will be available in quote and invoice item selection.</p>
              </div>
              <button type="button" onClick={closeForm} aria-label="Close catalog item form" className="rounded-lg p-2 text-xl leading-none text-slate-400 hover:bg-slate-100">×</button>
            </div>
            <ServiceCreateForm
              key={editingProduct?.id ?? 'new'}
              availableUnits={products.map((product) => product.unit)}
              products={products}
              product={editingProduct ?? undefined}
              onCancel={closeForm}
              onCreated={handleCreated}
              onUpdated={handleUpdated}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
