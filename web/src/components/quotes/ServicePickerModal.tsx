'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '@/types/entities';
import { ServiceCreateForm } from './ServiceCreateForm';

interface ServicePickerModalProps {
  open: boolean;
  products: Product[];
  selectedId?: number;
  canCreate?: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
  onRemoveSelected: () => void;
}

export function ServicePickerModal({ open, products, selectedId, canCreate = false, onClose, onSelect, onRemoveSelected }: ServicePickerModalProps) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setQuery('');
        setCreating(false);
        setCreateError(null);
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const activeProducts = products.filter((product) => product.isActive);
  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return activeProducts;
    return activeProducts.filter((product) => [product.name, product.sku].some((value) => value?.toLowerCase().includes(normalized)));
  }, [activeProducts, query]);
  const selectedProduct = products.find((product) => product.id === selectedId);

  if (!open) return null;
  function closePicker() {
    setQuery('');
    setCreating(false);
    setCreateError(null);
    onClose();
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closePicker(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="service-picker-title" className="max-h-[min(760px,calc(100vh-2rem))] w-full max-w-2xl overflow-hidden rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
    <div className="flex items-start justify-between gap-4"><div><h2 id="service-picker-title" className="text-lg font-semibold text-slate-900">Select item</h2><p className="mt-1 text-sm text-slate-500">Search existing goods and services or add a catalog item.</p></div><button type="button" onClick={closePicker} aria-label="Close item picker" className="rounded-lg p-2 text-xl leading-none text-slate-400 hover:bg-slate-100">×</button></div>
      {!creating ? <>
        {selectedProduct ? <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-2.5"><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">Added to quote</p><p className="truncate text-sm font-medium text-slate-800">{selectedProduct.name}</p></div><button type="button" onClick={onRemoveSelected} aria-label={`Remove ${selectedProduct.name} from quote`} title="Remove from quote" className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg></button></div> : null}
        <div className="mt-5 flex flex-wrap items-center gap-2"><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search items or SKU" aria-label="Search items" className="min-w-48 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400" />{canCreate ? <button type="button" onClick={() => { setQuery(''); setCreating(true); }} aria-label="Add new item" title="Add new item" className="rounded-xl bg-orange-500 p-2 text-xl leading-none font-medium text-white hover:bg-orange-600">+</button> : null}</div>
        {filteredProducts.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No active items found.</p> : <div className="mt-4 max-h-[min(22rem,45vh)] space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="listbox" aria-label="Items">{filteredProducts.map((product) => <button type="button" role="option" aria-selected={product.id === selectedId} key={product.id} onClick={() => { setQuery(''); onSelect(product); }} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-orange-300 hover:bg-orange-50"><span className="flex items-center justify-between gap-3"><span className="font-semibold text-slate-900">{product.name}</span><span className="font-medium text-slate-700">{product.price.toFixed(2)}</span></span><span className="mt-1 block text-sm text-slate-500">{product.description || 'No description'}{product.sku ? ` · SKU ${product.sku}` : ''}</span><span className="mt-1 block text-xs text-slate-400">{product.type === 'GOODS' ? 'Goods' : 'Services'} · {product.unit} · Tax {product.taxRate ?? 0}%</span></button>)}</div>}
      </> : <div className="mt-5"><ServiceCreateForm availableUnits={products.map((product) => product.unit)} onCancel={() => setCreating(false)} onCreated={(product) => { setCreating(false); onSelect(product); }} /></div>}
      {createError ? <p role="alert" className="mt-3 text-sm text-rose-600">{createError}</p> : null}
    </div>
  </div>;
}
