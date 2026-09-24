'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCustomers, type Customer } from '@/api/customersApi';

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomers().finally(() => setLoading(false)).then(setCustomers).catch(() => undefined);
  }, []);

  return <main className="p-6"><div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">CRM</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Customers</h1><p className="mt-1 text-sm text-slate-500">Manage business and individual customers.</p></div><button type="button" onClick={() => router.push('/dashboard/customers/add')} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">+ Add Customer</button></div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Customer Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Projects</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr> : customers.map((customer) => <tr key={customer.id}><td className="px-4 py-3 font-medium text-slate-800">{customer.customerName}</td><td className="px-4 py-3 text-slate-600">{customer.customerType === 'BUSINESS' ? 'Business' : 'Individual'}</td><td className="px-4 py-3 text-slate-600">{customer.city}, {customer.country}</td><td className="px-4 py-3 text-slate-600">{customer._count?.projects ?? 0}</td><td className="px-4 py-3 text-slate-600">{customer.status}</td></tr>)}</tbody></table>{!loading && customers.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No customers found.</p>}</div></main>;
}
