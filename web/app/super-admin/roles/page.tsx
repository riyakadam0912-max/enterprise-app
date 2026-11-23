'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Pencil, Plus, Search, ShieldCheck } from 'lucide-react';
import {
  listPermissions,
  listRoles,
  createRole,
  updateRole,
  updateRoleModuleAccess,
  type RoleRecord,
  type PermissionRecord,
} from '@/api/rbacApi';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog } from '@/components/Dialog';
import { toast } from '@/providers/toast-provider';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  MODULE_ACCESS,
  hasModulePermissionCatalog,
} from '@/config/module-access';
import type { AuthRole } from '@/stores/auth-store';

const roleSchema = z.object({
  name: z.string().trim().min(2, 'Role name is required'),
  description: z.string().optional().or(z.literal('')),
});

type RoleFormValues = z.infer<typeof roleSchema>;

export default function SuperAdminRoles() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [moduleUpdating, setModuleUpdating] = useState<string | null>(null);

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: '', description: '' },
  });

  const loadData = async () => {
    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([listRoles(), listPermissions()]);
      setRoles(rolesResponse);
      setPermissions(permissionsResponse);
      return true;
    } catch (error) {
      toast.error(
        'RBAC data unavailable',
        error instanceof Error ? error.message : 'Unable to load roles',
      );
      return false;
    }
  };

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        await loadData();
      } finally {
        if (active) setLoading(false);
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, []);

  const availablePermissionKeys = useMemo(
    () => new Set(permissions.map((permission) => permission.key)),
    [permissions],
  );

  const filteredModules = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return MODULE_ACCESS;
    return MODULE_ACCESS.filter((module) =>
      `${module.label} ${module.description}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  const rolePermissionKeys = (role: RoleRecord) =>
    new Set(role.rolePermissions.map((entry) => entry.permission.key));

  const isModuleEnabled = (role: RoleRecord, module: (typeof MODULE_ACCESS)[number]) => {
    if (role.name === 'SUPER_ADMIN') return true;
    const keys = [...rolePermissionKeys(role)];
    if (hasModulePermissionCatalog(keys)) {
      return rolePermissionKeys(role).has(module.permission);
    }
    return module.legacyRoles.includes(role.name as AuthRole);
  };

  const toggleModuleAccess = async (role: RoleRecord, permissionKey: string) => {
    if (role.name === 'SUPER_ADMIN' || !availablePermissionKeys.has(permissionKey)) return;
    const updateKey = `${role.id}:${permissionKey}`;
    setModuleUpdating(updateKey);
    const enabled = isModuleEnabled(
      role,
      MODULE_ACCESS.find((module) => module.permission === permissionKey)!,
    );
    try {
      const currentKeys = [...rolePermissionKeys(role)];
      const hasCatalog = hasModulePermissionCatalog(currentKeys);
      const enabledKeys = hasCatalog
        ? MODULE_ACCESS
            .filter((module) => currentKeys.includes(module.permission))
            .map((module) => module.permission)
        : MODULE_ACCESS
            .filter((module) => module.legacyRoles.includes(role.name as AuthRole))
            .map((module) => module.permission);

      const desiredKeys = enabled
        ? enabledKeys.filter((key) => key !== permissionKey)
        : [...new Set([...enabledKeys, permissionKey])];

      await updateRoleModuleAccess(role.id, desiredKeys);
      await loadData();
      toast.success(
        'Module visibility updated',
        `${MODULE_ACCESS.find((module) => module.permission === permissionKey)?.label ?? 'Module'} ${enabled ? 'hidden from' : 'shown to'} ${role.name.replaceAll('_', ' ')}.`,
      );
    } catch (error) {
      toast.error('Unable to update visibility', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setModuleUpdating(null);
    }
  };

  const openRoleDialog = (role?: RoleRecord) => {
    setEditingRole(role ?? null);
    reset(role
      ? { name: role.name, description: role.description ?? '' }
      : { name: '', description: '' });
    setRoleDialogOpen(true);
  };

  const handleRoleSave = async (values: RoleFormValues) => {
    setRoleSubmitting(true);
    try {
      if (editingRole) {
        await updateRole(editingRole.id, values.name.trim(), values.description?.trim() || undefined);
        toast.success('Role updated', `Changes to "${values.name}" were saved.`);
      } else {
        await createRole(values.name.trim(), values.description?.trim() || undefined);
        toast.success('Role created', `"${values.name}" is now available.`);
      }
      await loadData();
      setRoleDialogOpen(false);
      setEditingRole(null);
      reset();
    } catch (error) {
      toast.error(
        editingRole ? 'Update failed' : 'Creation failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setRoleSubmitting(false);
    }
  };

  return (
    <>
      <SuperAdminPageShell
        title="Roles & module access"
        description="Control exactly which dashboard modules each role can see."
        actions={
          <Button onClick={() => openRoleDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Create role
          </Button>
        }
      >
        <Card className="border-slate-200/80 bg-white p-0 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-950">Module visibility matrix</h2>
                <p className="text-sm text-slate-500">
                  On means visible in the dashboard. Changes apply after the next sign-in refresh.
                </p>
              </div>
            </div>
            <div className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a module"
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading access controls…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="sticky left-0 z-10 min-w-64 border-b border-r border-slate-200 bg-slate-50 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Module
                    </th>
                    {roles.map((role) => (
                      <th key={role.id} className="min-w-28 border-b border-slate-200 px-3 py-3 text-center">
                        <span className="block truncate text-xs font-semibold text-slate-700">
                          {role.name.replaceAll('_', ' ')}
                        </span>
                        {role.name === 'SUPER_ADMIN' ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600">
                            <Lock className="h-3 w-3" /> Always on
                          </span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredModules.map((module) => (
                    <tr key={module.id} className="group hover:bg-slate-50/70">
                      <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-5 py-3 group-hover:bg-slate-50">
                        <p className="text-sm font-semibold text-slate-900">{module.label}</p>
                        <p className="mt-0.5 max-w-56 truncate text-xs text-slate-500">{module.description}</p>
                      </td>
                      {roles.map((role) => {
                        const superAdmin = role.name === 'SUPER_ADMIN';
                        const enabled = superAdmin || isModuleEnabled(role, module);
                        const available = availablePermissionKeys.has(module.permission);
                        const busy = moduleUpdating === `${role.id}:${module.permission}`;
                        return (
                          <td key={role.id} className="border-b border-slate-200 px-3 py-3 text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={enabled}
                              aria-label={`${enabled ? 'Hide' : 'Show'} ${module.label} for ${role.name.replaceAll('_', ' ')}`}
                              disabled={superAdmin || busy || !available}
                              onClick={() => void toggleModuleAccess(role, module.permission)}
                              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                                enabled ? 'bg-emerald-500' : 'bg-slate-300'
                              } disabled:cursor-not-allowed disabled:opacity-70`}
                            >
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-500 shadow transition ${
                                  enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              >
                                {busy ? (
                                  <span className="h-2.5 w-2.5 animate-spin rounded-full border border-slate-300 border-t-slate-600" />
                                ) : superAdmin ? (
                                  <Lock className="h-3 w-3" />
                                ) : enabled ? (
                                  <Eye className="h-3 w-3" />
                                ) : (
                                  <EyeOff className="h-3 w-3" />
                                )}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredModules.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">No modules match "{query}".</div>
              ) : null}
            </div>
          )}
        </Card>

        {!loading && roles.length > 0 ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Role details</h2>
              <span className="text-xs text-slate-500">{roles.length} roles</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {roles.map((role) => (
                <Card key={role.id} className="border-slate-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">{role.name.replaceAll('_', ' ')}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {role.description ?? 'Role definition'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openRoleDialog(role)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <span>Assigned permissions</span>
                    <span className="font-semibold text-slate-900">{role.rolePermissions.length}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </SuperAdminPageShell>

      <Dialog
        open={roleDialogOpen}
        title={editingRole ? 'Edit role' : 'Create role'}
        description={editingRole ? `Update metadata for "${editingRole.name}".` : 'Define a role for module access and permissions.'}
        onClose={() => setRoleDialogOpen(false)}
        onConfirm={handleSubmit(handleRoleSave)}
        confirmLoading={roleSubmitting}
        confirmLabel={editingRole ? 'Save changes' : 'Create role'}
      >
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <div>
            <Label htmlFor="role-name">Role name</Label>
            <Input id="role-name" className="mt-1.5" placeholder="e.g. Finance Manager" {...register('name')} />
            {errors.name ? <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
              className="mt-1.5"
              placeholder="Summarize the purpose of this role"
              {...register('description')}
            />
          </div>
        </form>
      </Dialog>
    </>
  );
}
