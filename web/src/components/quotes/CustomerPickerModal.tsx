'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Customer } from '@/api/customersApi';

interface CustomerPickerModalProps {
  open: boolean;
  customers: Customer[];
  selectedId?: number;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  onCreateCustomer: () => void;
}

function customerAddress(customer: Customer) {
  return [customer.addressLine1, customer.addressLine2, customer.city, customer.state, customer.zipCode].filter(Boolean).join(', ');
}

export function CustomerPickerModal({ open, customers, selectedId, loading = false, error = null, onClose, onSelect, onCreateCustomer }: CustomerPickerModalProps) {
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setQuery('');
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const filteredCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return customers;
    return customers.filter((customer) => [customer.customerName, customer.email, customer.phoneNumber, customer.city].some((value) => value?.toLowerCase().includes(normalized)));
  }, [customers, query]);

  if (!open) return null;

  function closePicker() {
    setQuery('');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closePicker(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="customer-picker-title" className="flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div><h2 id="customer-picker-title" className="text-lg font-semibold text-slate-900">Select customer</h2><p className="mt-1 text-sm text-slate-500">Search your organization&apos;s customer directory.</p></div>
          <button type="button" onClick={closePicker} aria-label="Close customer picker" className="rounded-lg p-2 text-xl leading-none text-slate-400 hover:bg-slate-100">×</button>
        </div>
        <>
            <div className="mt-5 flex shrink-0 gap-2">
              <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, phone, or city" aria-label="Search customers" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400" />
              <button type="button" onClick={onCreateCustomer} className="shrink-0 rounded-xl bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600">New customer</button>
            </div>
            {loading ? <p className="py-10 text-center text-sm text-slate-500" role="status">Loading customers...</p> : error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600" role="alert">{error}</p> : filteredCustomers.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No customers found.</p> : (
              <div className="mt-4 max-h-[min(22rem,45vh)] min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="listbox" aria-label="Customers">
                {filteredCustomers.map((customer) => <button type="button" role="option" aria-selected={customer.id === selectedId} key={customer.id} onClick={() => { setQuery(''); onSelect(customer); }} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-orange-300 hover:bg-orange-50">
                  <span className="block font-semibold text-slate-900">{customer.customerName}</span>
                  <span className="mt-1 block text-sm text-slate-500">{[customer.email, customer.phoneNumber].filter(Boolean).join(' · ') || 'No contact details'}</span>
                  <span className="mt-1 block text-xs text-slate-400">{customerAddress(customer) || 'No address'}</span>
                </button>)}
              </div>
            )}
        </>
      </div>
    </div>
  );
}
