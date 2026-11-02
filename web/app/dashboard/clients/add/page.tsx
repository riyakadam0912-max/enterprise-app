'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCustomers, type Customer } from '@/api/customersApi';
import { createClientUser } from '@/api/clientPortalApi';
import { getProjects, type Project } from '@/api/projectsApi';
import { CustomerPickerModal } from '@/components/quotes/CustomerPickerModal';
import { CustomerSelectField } from '@/components/customers/CustomerSelectField';

const field = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100';
const CLIENT_CUSTOMER_RETURN_STORAGE_KEY = 'client-user-customer-return-draft';

export default function AddClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [email, setEmail] = useState('');
  const [template, setTemplate] = useState('client-invitation');
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [projectMode, setProjectMode] = useState<'all' | 'working'>('working');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const createdCustomerId = searchParams.get('createdCustomerId');

  useEffect(() => {
    Promise.all([getCustomers(), getProjects()])
      .then(([loadedCustomers, loadedProjects]) => {
        setCustomers(loadedCustomers);
        setProjects(loadedProjects);
      })
      .catch(() => setError('Unable to load customers and projects.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!createdCustomerId) return;

    const savedDraft = sessionStorage.getItem(CLIENT_CUSTOMER_RETURN_STORAGE_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft) as {
          email?: string;
          template?: string;
          projectIds?: number[];
          projectMode?: 'all' | 'working';
        };
        if (draft.email !== undefined) setEmail(draft.email);
        if (draft.template !== undefined) setTemplate(draft.template);
        if (draft.projectIds !== undefined) setProjectIds(draft.projectIds);
        if (draft.projectMode !== undefined) setProjectMode(draft.projectMode);
      } catch {
        setError('Unable to restore the client invitation draft.');
      }
    }

    setCustomerId(createdCustomerId);
    sessionStorage.removeItem(CLIENT_CUSTOMER_RETURN_STORAGE_KEY);
    window.history.replaceState({}, '', '/dashboard/clients/add');
  }, [createdCustomerId]);

  const visibleProjects = useMemo(
    () => projectMode === 'working' ? projects.filter((project) => !['COMPLETED', 'BLOCKED_CANCELLED', 'POSTPONED'].includes(project.status)) : projects,
    [projectMode, projects],
  );

  function toggleProject(projectId: number) {
    setProjectIds((current) => current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId]);
  }

  function handleCreateCustomer() {
    sessionStorage.setItem(CLIENT_CUSTOMER_RETURN_STORAGE_KEY, JSON.stringify({
      email,
      template,
      projectIds,
      projectMode,
    }));
    setCustomerPickerOpen(false);
    router.push('/dashboard/customers/add?returnTo=%2Fdashboard%2Fclients%2Fadd');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!customerId || !email.trim() || projectIds.length === 0) {
      setError('Customer, email, and at least one project are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createClientUser({ customerId: Number(customerId), email: email.trim(), invitationTemplate: template, projectIds });
      router.push('/dashboard/clients');
    } catch {
      setError('Unable to send the client invitation.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-3xl p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Client portal</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Add client user</h1>
          <p className="mt-1 text-sm text-slate-500">Invite a customer to selected projects.</p>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading ? <p className="text-sm text-slate-500">Loading onboarding options...</p> : (
        <form onSubmit={submit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <CustomerSelectField
            selectedName={customers.find((customer) => String(customer.id) === customerId)?.customerName ?? ''}
            onClick={() => setCustomerPickerOpen(true)}
          />
          <label className="block text-sm font-medium text-slate-700">Email ID
            <input className={`${field} mt-1`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="client@example.com" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Invitation Template
            <select className={`${field} mt-1`} value={template} onChange={(event) => setTemplate(event.target.value)}>
              <option value="client-invitation">Client portal invitation</option>
            </select>
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Associated Projects</legend>
            <div className="mt-2 flex gap-2" role="tablist" aria-label="Project scope">
              {(['all', 'working'] as const).map((mode) => <button key={mode} type="button" onClick={() => setProjectMode(mode)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${projectMode === mode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{mode === 'all' ? 'All Projects' : 'Working Projects'}</button>)}
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {visibleProjects.length === 0 ? <p className="text-sm text-slate-500">No projects available.</p> : visibleProjects.map((project) => <label key={project.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-50"><input type="checkbox" checked={projectIds.includes(project.id)} onChange={() => toggleProject(project.id)} /><span className="text-sm text-slate-700">{project.projectName}</span><span className="ml-auto text-xs text-slate-400">{project.status}</span></label>)}
            </div>
          </fieldset>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => router.back()} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{saving ? 'Sending...' : 'Send Invitation'}</button>
          </div>
        </form>
      )}
      <CustomerPickerModal
        open={customerPickerOpen}
        customers={customers}
        selectedId={Number(customerId) || undefined}
        loading={loading}
        error={error || null}
        nameOnly
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(customer) => {
          setCustomerId(String(customer.id));
          setCustomerPickerOpen(false);
        }}
        onCreateCustomer={handleCreateCustomer}
      />
    </main>
  );
}
