'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createCustomer, type Customer, type CustomerInput } from '@/api/customersApi';

const initialForm: CustomerInput = {
  customerName: '',
  customerType: 'BUSINESS',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: 'India',
  zipCode: '',
  email: '',
  phoneNumber: '',
  webAddress: null,
};

interface CustomerCreateFormProps {
  onCreated: (customer: Customer) => void;
  onCancel: () => void;
}

export function CustomerCreateForm({ onCreated, onCancel }: CustomerCreateFormProps) {
  const [form, setForm] = useState<CustomerInput>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  function setField<K extends keyof CustomerInput>(field: K, value: CustomerInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createCustomer(form);
      setForm(initialForm);
      onCreated(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create customer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Create customer form">
      <div className="grid gap-3 sm:grid-cols-2">
        {([['customerName', 'Customer name'], ['addressLine1', 'Address'], ['addressLine2', 'Address line 2'], ['city', 'City'], ['state', 'State'], ['zipCode', 'Postal code'], ['email', 'Email'], ['phoneNumber', 'Phone']] as const).map(([field, label]) => (
          <label key={field} className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            <input
              required={['customerName', 'addressLine1', 'city', 'state', 'zipCode'].includes(field)}
              type={field === 'email' ? 'email' : 'text'}
              value={String(form[field] ?? '')}
              ref={field === 'customerName' ? nameInputRef : undefined}
              onChange={(event) => setField(field, event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400"
            />
          </label>
        ))}
      </div>
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button>
        <button type="submit" disabled={saving} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? 'Creating...' : 'Create customer'}</button>
      </div>
    </form>
  );
}
