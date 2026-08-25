'use client';

import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Plus, Save } from 'lucide-react';
import { getMyOrganization, listOrganizations, updateMyOrganization, type Organization } from '@/api/organizationsApi';
import { isSuperAdminSession, useAuthSession } from '@/stores/auth-store';
import { OrganizationCreateModal } from '@/components/super-admin/OrganizationCreateModal';

type EditableField = 'name' | 'slug' | 'email' | 'phone' | 'address' | 'city' | 'state' | 'country' | 'timezone' | 'currency' | 'website' | 'industry';
const fields: Array<{ key: EditableField; label: string; type?: string }> = [
  { key: 'name', label: 'Organization name' }, { key: 'slug', label: 'Slug' },
  { key: 'email', label: 'Business email', type: 'email' }, { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website', type: 'url' }, { key: 'industry', label: 'Industry' },
  { key: 'address', label: 'Address' }, { key: 'city', label: 'City' },
  { key: 'state', label: 'State' }, { key: 'country', label: 'Country' },
  { key: 'timezone', label: 'Timezone' }, { key: 'currency', label: 'Currency' },
];

export default function OrganizationPage() {
  const session = useAuthSession();
  const isSuperAdmin = isSuperAdminSession(session);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [form, setForm] = useState<Record<EditableField, string>>({} as Record<EditableField, string>);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      listOrganizations().then(setOrganizations).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load organizations');
      }).finally(() => setLoading(false));
      return;
    }

    if (session.role !== 'ADMIN') {
      setLoading(false);
      return;
    }

    getMyOrganization().then((data) => {
      setOrganization(data);
      setForm(Object.fromEntries(fields.map(({ key }) => [key, data[key] ?? ''])) as Record<EditableField, string>);
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load your organization')).finally(() => setLoading(false));
  }, [isSuperAdmin, session.role]);

  const set = (key: EditableField, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setSaved(false); setError(null);
    try { const updated = await updateMyOrganization(form); setOrganization(updated); setSaved(true); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Unable to save organization details'); }
    finally { setSaving(false); }
  }

  if (isSuperAdmin) {
    return <div className="min-h-full bg-slate-50 p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white"><Building2 className="h-5 w-5" /></div><div><h1 className="text-2xl font-semibold text-slate-900">Organizations</h1><p className="text-sm text-slate-500">Create and manage organizations across the platform.</p></div></div>
        <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"><Plus className="h-4 w-4" />Create organization</button>
      </div>
      {error ? <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-500">Loading organizations…</div> : <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Organization</th><th className="px-5 py-3">Code</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Created</th></tr></thead><tbody className="divide-y divide-slate-200">{organizations.map((item) => <tr key={item.id}><td className="px-5 py-4 font-medium text-slate-900">{item.name}<span className="ml-2 text-xs font-normal text-slate-500">{item.slug}</span></td><td className="px-5 py-4 text-slate-600">{item.code}</td><td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{item.status}</span></td><td className="px-5 py-4 text-slate-600">{new Date(item.createdAt).toLocaleDateString('en-GB')}</td></tr>)}</tbody></table></div></div>}
      <OrganizationCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { void listOrganizations().then(setOrganizations); }} />
    </div>;
  }

  if (session.role !== 'ADMIN') return null;
  if (loading) return <div className="p-6 text-sm text-slate-500">Loading organization…</div>;

  return <div className="min-h-full bg-slate-50 p-6">
    <div className="mb-6 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white"><Building2 className="h-5 w-5" /></div><div><h1 className="text-2xl font-semibold text-slate-900">Organization</h1><p className="text-sm text-slate-500">Manage your organization profile.</p></div></div>
    {error ? <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
    {organization ? <form onSubmit={handleSubmit} className="max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4"><div><p className="font-semibold text-slate-900">Organization profile</p><p className="text-sm text-slate-500">Status: {organization.status}</p></div>{saved ? <span className="text-sm text-emerald-600">Saved</span> : null}</div><div className="grid gap-4 md:grid-cols-2">{fields.map(({ key, label, type }) => <label key={key} className="space-y-1.5 text-sm"><span className="block font-medium text-slate-700">{label}</span><input type={type ?? 'text'} value={form[key]} onChange={(event) => set(key, event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-orange-400" /></label>)}</div><div className="mt-6 flex justify-end"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save changes'}</button></div></form> : null}
  </div>;
}