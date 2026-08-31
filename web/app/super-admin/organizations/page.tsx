'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle2, ChevronDown, ChevronRight, Pencil, Plus, Search } from 'lucide-react';

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

type OrganizationRow = { organization: Organization; depth: number; hasChildren: boolean };

function flattenOrganizationTree(organizations: Organization[], visibleIds: Set<number>): OrganizationRow[] {
  const byParent = new Map<number | null, Organization[]>();
  for (const organization of organizations) {
    const parentId = organization.parentId ?? null;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), organization]);
  }

  const rows: OrganizationRow[] = [];
  const visited = new Set<number>();
  const visit = (parentId: number | null, depth: number) => {
    for (const organization of byParent.get(parentId) ?? []) {
      if (visited.has(organization.id) || !visibleIds.has(organization.id)) continue;
      visited.add(organization.id);
      const hasChildren = (byParent.get(organization.id) ?? []).some((child) => visibleIds.has(child.id));
      rows.push({ organization, depth, hasChildren });
      visit(organization.id, depth + 1);
    }
  };

  visit(null, 0);
  for (const organization of organizations) {
    if (!visited.has(organization.id) && visibleIds.has(organization.id)) {
      visited.add(organization.id);
      rows.push({ organization, depth: 0, hasChildren: false });
      visit(organization.id, 1);
    }
  }
  return rows;
}

export default function SuperAdminOrganizations() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [busyOrgId, setBusyOrgId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const loadOrganizations = async () => {
      try {
        setLoadError(null);
        const data = await listOrganizations({ limit: 1000 });
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

  const organizationRows = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    const matches = organizations.filter((org) => {
      const matchesSearch = !normalizedQuery || [org.name, org.code, org.slug, org.status].join(' ').toLowerCase().includes(normalizedQuery);
      const matchesStatus = !statusFilter || org.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
    const visibleIds = new Set(matches.map((organization) => organization.id));
    for (const organization of matches) {
      let parentId = organization.parentId ?? null;
      while (parentId != null) {
        visibleIds.add(parentId);
        parentId = organizations.find((candidate) => candidate.id === parentId)?.parentId ?? null;
      }
    }
    return flattenOrganizationTree(organizations, visibleIds);
  }, [organizations, search, statusFilter]);

  const handleOpenOrganization = (organizationId: number) => {
    setActiveOrganization(organizationId);
    router.replace('/dashboard');
  };

  const refreshOrganizations = async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const data = await listOrganizations({ limit: 1000 });
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
        <Button onClick={() => { setEditingOrg(null); setModalOpen(true); }}>
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
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Loading organizations…</td></tr>
              ) : organizationRows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">No organizations match your filters.</td></tr>
              ) : organizationRows.map(({ organization: org, depth, hasChildren }) => (
                <tr key={org.id} className="transition hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3" style={{ paddingLeft: `${depth * 28}px` }}>
                      {hasChildren ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />}
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
                    <p className="font-medium text-slate-900">{formatDate(org.createdAt)}</p>
                    <p className="text-sm text-slate-500">{org.code}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" onClick={() => handleOpenOrganization(org.id)} className="bg-indigo-600 hover:bg-indigo-700">
                        <Building2 className="mr-2 h-4 w-4" />
                        Open
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => { setEditingOrg(org); setModalOpen(true); }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
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

      <OrganizationCreateModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingOrg(null); }}
        onCreated={refreshOrganizations}
        organization={editingOrg}
      />

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
