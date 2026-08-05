'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { listPermissions, listRoles, type RoleRecord, type PermissionRecord } from '@/api/rbacApi';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/providers/toast-provider';

export default function SuperAdminRoles() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [rolesResponse, permissionsResponse] = await Promise.all([listRoles(), listPermissions()]);
        if (!active) return;
        setRoles(rolesResponse);
        setPermissions(permissionsResponse);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Unable to load roles';
        toast.error('RBAC data unavailable', message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();
    return () => {
      active = false;
    };
  }, []);

  const filteredRoles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return roles.filter((role) => !normalizedQuery || [role.name, role.description ?? '', role.rolePermissions.map((permission) => permission.permission.key).join(' ')].join(' ').toLowerCase().includes(normalizedQuery));
  }, [query, roles]);

  return (
    <SuperAdminPageShell title="Roles & permissions" description="Inspect and manage role-based access across modules and organizations." actions={<Button><Plus className="mr-2 h-4 w-4" />Create role</Button>}>
      <Card className="border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search roles or permissions" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-10" />
        </div>
      </Card>

      {loading ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-8 text-center text-sm text-slate-500">Loading roles…</div>
      ) : filteredRoles.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-8 text-center text-sm text-slate-500">No roles match your search.</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {filteredRoles.map((role) => (
            <Card key={role.id} className="border-slate-200/80 bg-white/80 p-5 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{role.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{role.description ?? 'Role definition from the platform RBAC service'}</p>
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{role.rolePermissions.length} permissions</span>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between"><span>Permissions</span><span className="font-medium text-slate-900">{role.rolePermissions.length}</span></div>
                <div className="mt-2 flex items-center justify-between"><span>Available catalog</span><span className="font-medium text-slate-900">{permissions.length}</span></div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" size="sm">Edit</Button>
                <Button size="sm">Assign</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </SuperAdminPageShell>
  );
}
