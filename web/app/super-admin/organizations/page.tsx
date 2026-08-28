'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle2, Plus, Search, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { setActiveOrganization } from '@/stores/auth-store';
import { listOrganizations, type Organization } from '@/api/organizationsApi';
import { OrganizationCreateModal } from '@/components/super-admin/OrganizationCreateModal';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';
import { apiClient } from '@/api/apiClient';
import { Dialog } from '@/components/Dialog';
import { toast } from '@/providers/toast-provider';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function SuperAdminOrganizations() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [busyOrgId, setBusyOrgId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const loadOrganizations = async () => {
      try {
        setLoadError(null);
        const data = await listOrganizations();
        if (!active) return;
        setOrganizations(data);
      } catch (error: unknown) {
        if (!active) return;
        setOrganizations([]);
        setLoadError(error instanceof Error ? error.message : 'Unable to load organizations.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadOrganizations();
    return () => { active = false; };
  }, []);

  const filteredOrganizations = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    return organizations.filter((org) => {
      const matchesSearch = !normalizedQuery || [org.name, org.code, org.slug, org.status].join(' ').toLowerCase().includes(normalizedQuery);
      const matchesStatus = !statusFilter || org.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [organizations, search, statusFilter]);

  const handleOpenOrganization = (organizationId: number) => {
    setActiveOrganization(organizationId);
    router.replace('/dashboard');
  };

  const refreshOrganizations = async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const data = await listOrganizations();
      setOrganizations(data);
    } catch (error: unknown) {
      setOrganizations([]);
      setLoadError(error instanceof Error ? error.message : 'Unable to load organizations.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (organization: Organization, nextStatus: 'activate' | 'suspend') => {
    setBusyOrgId(organization.id);
    try {
      await apiClient(`/organizations/${organization.id}/${nextStatus === 'activate' ? 'activate' : 'suspend'}`, { method: 'PATCH' });
      await refreshOrganizations();
      toast.success(`Organization ${nextStatus === 'activate' ? 'activated' : 'suspended'}`, `${organization.name} is now ${nextStatus === 'activate' ? 'active' : 'suspended'}.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to change organization status';
      toast.error('Status update failed', message);
    } finally {
      setBusyOrgId(null);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!activeOrg) return;
    setBusyOrgId(activeOrg.id);
    try {
      await apiClient(`/organizations/${activeOrg.id}`, { method: 'DELETE' });
      await refreshOrganizations();
      toast.success('Organization deleted', `${activeOrg.name} has been removed from the platform.`);
      setActiveOrg(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to delete organization';
      toast.error('Delete failed', message);
    } finally {
      setBusyOrgId(null);
    }
  };

  return (
    <SuperAdminPageShell
      title="Organizations"
      description="Manage tenants, health, and lifecycle with a premium administration experience."
      actions={
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create organization
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search by name, slug, or status" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" />
          </div>
        </Card>
        <Card className="border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </Card>
      </div>

      {loadError ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {loadError}
        </Card>
      ) : null}

      <Card className="overflow-hidden border-slate-200/80 bg-white/80 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Admin / Country</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">Loading organizations…</td></tr>
              ) : filteredOrganizations.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">No organizations match your filters.</td></tr>
              ) : filteredOrganizations.map((org) => (
                <tr key={org.id} className="transition hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white">
                        {org.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{org.name}</p>
                        <p className="text-sm text-slate-500">{org.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${org.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : org.status === 'SUSPENDED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {org.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-900">{org.adminUser ?? '—'}</p>
                    <p className="text-sm text-slate-500">{org.country ?? '—'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users className="h-4 w-4 text-slate-400" />
                      <span>1.8K users</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">142 GB / 500 GB</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-900">{formatDate(org.createdAt)}</p>
                    <p className="text-sm text-slate-500">{org.code}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" onClick={() => handleOpenOrganization(org.id)} className="bg-indigo-600 hover:bg-indigo-700">
                        <Building2 className="mr-2 h-4 w-4" />
                        Open
                      </Button>
                      <Button type="button" variant="outline" size="sm" loading={busyOrgId === org.id} onClick={() => void handleStatusChange(org, org.status === 'ACTIVE' ? 'suspend' : 'activate')}>
                        {org.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setActiveOrg(org)} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <OrganizationCreateModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={refreshOrganizations} />

      <Dialog
        open={Boolean(activeOrg)}
        title="Delete organization"
        description={`This will remove ${activeOrg?.name ?? 'this organization'} from the platform. This action cannot be undone.`}
        onClose={() => setActiveOrg(null)}
        onConfirm={() => void handleDeleteOrganization()}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
      />
    </SuperAdminPageShell>
  );
}
