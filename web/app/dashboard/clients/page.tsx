'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClientUsers, type ClientUser } from '@/api/clientPortalApi';

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getClientUsers().then(setClients).catch(() => setError('Unable to load client users.'));
  }, []);

  return (
    <main className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Organization</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Client users</h1><p className="mt-1 text-sm text-slate-500">Manage customer portal invitations and project access.</p></div>
        <button type="button" onClick={() => router.push('/dashboard/clients/add')} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">+ Add Client</button>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Projects</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{clients.map((client) => <tr key={client.id}><td className="px-4 py-3 font-medium text-slate-800">{client.contact.contactName}</td><td className="px-4 py-3 text-slate-600">{client.user.email}</td><td className="px-4 py-3 text-slate-600">{client.projectAccess.length}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{client.status}</span></td></tr>)}</tbody></table>
        {clients.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No client users yet.</p>}
      </div>
    </main>
  );
}
