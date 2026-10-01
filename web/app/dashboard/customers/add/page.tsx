'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomer, type CustomerInput, type CustomerType } from '@/api/customersApi';

const field = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100';

const initialForm: CustomerInput = {
  customerName: '',
  customerType: 'BUSINESS',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  zipCode: '',
  webAddress: '',
  email: '',
  phoneNumber: '',
};

export default function AddCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState<CustomerInput>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createCustomer(form);
      router.push('/dashboard/customers');
    } catch {
      setError('Unable to create customer. Check the required fields and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-3xl p-6">
      <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">CRM</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Add Customer</h1></div>
      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">Customer Name<input required className={`${field} mt-1`} value={form.customerName} onChange={(event) => setField('customerName', event.target.value)} /></label>
        <fieldset><legend className="text-sm font-medium text-slate-700">Customer Type</legend><div className="mt-2 flex gap-2">{(['BUSINESS', 'INDIVIDUAL'] as CustomerType[]).map((type) => <button type="button" key={type} onClick={() => setField('customerType', type)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${form.customerType === type ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{type === 'BUSINESS' ? 'Business' : 'Individual'}</button>)}</div></fieldset>
        <div className="grid gap-5 md:grid-cols-2"><label className="block text-sm font-medium text-slate-700 md:col-span-2">Address line 1<input required className={`${field} mt-1`} value={form.addressLine1} onChange={(event) => setField('addressLine1', event.target.value)} /></label><label className="block text-sm font-medium text-slate-700 md:col-span-2">Address line 2<input className={`${field} mt-1`} value={form.addressLine2 ?? ''} onChange={(event) => setField('addressLine2', event.target.value)} /></label><label className="block text-sm font-medium text-slate-700">City<input required className={`${field} mt-1`} value={form.city} onChange={(event) => setField('city', event.target.value)} /></label><label className="block text-sm font-medium text-slate-700">State<input required className={`${field} mt-1`} value={form.state} onChange={(event) => setField('state', event.target.value)} /></label><label className="block text-sm font-medium text-slate-700">Country<input required className={`${field} mt-1`} value={form.country} onChange={(event) => setField('country', event.target.value)} /></label><label className="block text-sm font-medium text-slate-700">Zip code<input required className={`${field} mt-1`} value={form.zipCode} onChange={(event) => setField('zipCode', event.target.value)} /></label></div>
        <label className="block text-sm font-medium text-slate-700">Web Address<input type="url" className={`${field} mt-1`} placeholder="https://" value={form.webAddress ?? ''} onChange={(event) => setField('webAddress', event.target.value)} /></label>
        <div className="grid gap-5 md:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Email<input type="email" className={`${field} mt-1`} value={form.email ?? ''} onChange={(event) => setField('email', event.target.value)} /></label><label className="block text-sm font-medium text-slate-700">Phone Number<input className={`${field} mt-1`} value={form.phoneNumber ?? ''} onChange={(event) => setField('phoneNumber', event.target.value)} /></label></div>
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4"><button type="button" onClick={() => router.back()} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{saving ? 'Saving...' : 'Save Customer'}</button></div>
      </form>
    </main>
  );
}
