'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, ShieldPlus, CheckCircle2 } from 'lucide-react';
import {
  listPermissions,
  listRoles,
  createRole,
  updateRole,
  assignPermissionToRole,
  removePermissionFromRole,
  type RoleRecord,
  type PermissionRecord,
} from '@/api/rbacApi';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/Dialog';
import { toast } from '@/providers/toast-provider';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const editRoleSchema = z.object({
  name: z.string().trim().min(2, 'Role name is required'),
  description: z.string().optional().or(z.literal('')),
});

const createRoleSchema = z.object({
  name: z.string().trim().min(2, 'Role name is required'),
  description: z.string().optional().or(z.literal('')),
});

type EditRoleFormValues = z.infer<typeof editRoleSchema>;
type CreateRoleFormValues = z.infer<typeof createRoleSchema>;

export default function SuperAdminRoles() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [editRoleSubmitting, setEditRoleSubmitting] = useState(false);

  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [createRoleSubmitting, setCreateRoleSubmitting] = useState(false);

  const [assignPermsOpen, setAssignPermsOpen] = useState(false);
  const [assignRole, setAssignRole] = useState<RoleRecord | null>(null);
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>([]);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const { register: editRegister, handleSubmit: editHandleSubmit, reset: editReset, formState: { errors: editErrors } } = useForm<EditRoleFormValues>({
    resolver: zodResolver(editRoleSchema),
    defaultValues: { name: '', description: '' },
  });

  const { register: createRegister, handleSubmit: createHandleSubmit, reset: createReset, formState: { errors: createErrors } } = useForm<CreateRoleFormValues>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { name: '', description: '' },
  });

  const loadData = async () => {
    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([listRoles(), listPermissions()]);
      setRoles(rolesResponse);
      setPermissions(permissionsResponse);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load roles';
      toast.error('RBAC data unavailable', message);
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

  const filteredRoles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return roles.filter((role) =>
      !normalizedQuery ||
      [
        role.name,
        role.description ?? '',
        role.rolePermissions.map((permission) => permission.permission.key).join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, roles]);

  const openEditRole = (role: RoleRecord) => {
    setEditingRole(role);
    editReset({ name: role.name, description: role.description ?? '' });
    setEditRoleOpen(true);
  };

  const handleEditSave = async (values: EditRoleFormValues) => {
    if (!editingRole) return;
    setEditRoleSubmitting(true);
    try {
      await updateRole(editingRole.id, values.name.trim(), values.description?.trim() || undefined);
      await loadData();
      toast.success('Role updated', `Changes to "${values.name}" were saved.`);
      setEditRoleOpen(false);
      setEditingRole(null);
      editReset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to update role';
      toast.error('Update failed', message);
    } finally {
      setEditRoleSubmitting(false);
    }
  };

  const openCreateRole = () => {
    createReset({ name: '', description: '' });
    setCreateRoleOpen(true);
  };

  const handleCreateSubmit = async (values: CreateRoleFormValues) => {
    setCreateRoleSubmitting(true);
    try {
      await createRole(values.name.trim(), values.description?.trim() || undefined);
      await loadData();
      toast.success('Role created', `"${values.name}" is now available.`);
      setCreateRoleOpen(false);
      createReset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to create role';
      toast.error('Creation failed', message);
    } finally {
      setCreateRoleSubmitting(false);
    }
  };

  const openAssignPerms = async (role: RoleRecord) => {
    setAssignRole(role);
    const refreshed = roles.find((r) => r.id === role.id) ?? role;
    const alreadyAssigned = refreshed.rolePermissions.map((rp) => rp.permission.key);
    setSelectedPermissionKeys(alreadyAssigned);
    setAssignPermsOpen(true);
  };

  const togglePermission = (key: string) => {
    setSelectedPermissionKeys((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  };

  const handleAssignSave = async () => {
    if (!assignRole) return;
    setAssignSubmitting(true);
    try {
      const current = assignRole.rolePermissions.map((rp) => rp.permission.key);
      const toAdd = selectedPermissionKeys.filter((key) => !current.includes(key));
      const toRemove = current.filter((key) => !selectedPermissionKeys.includes(key));

      await Promise.all([
        ...toAdd.map((key) => assignPermissionToRole(assignRole.id, key)),
        ...toRemove.map((key) => removePermissionFromRole(assignRole.id, key)),
      ]);

      await loadData();
      toast.success('Permissions updated', `Applied ${toAdd.length + toRemove.length} permission changes.`);
      setAssignPermsOpen(false);
      setAssignRole(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to update permissions';
      toast.error('Permission update failed', message);
    } finally {
      setAssignSubmitting(false);
    }
  };

  return (
    <>
      <SuperAdminPageShell
        title="Roles & permissions"
        description="Inspect and manage role-based access across modules and organizations."
        actions={
          <Button onClick={openCreateRole}>
            <Plus className="mr-2 h-4 w-4" />
            Create role
          </Button>
        }
      >
        <Card className="border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search roles or permissions"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-10"
            />
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
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                    {role.rolePermissions.length} permissions
                  </span>
                </div>
                <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Permissions</span>
                    <span className="font-medium text-slate-900">{role.rolePermissions.length}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Available catalog</span>
                    <span className="font-medium text-slate-900">{permissions.length}</span>
                  </div>
                </div>
                {role.rolePermissions.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {role.rolePermissions.slice(0, 6).map((rp) => (
                      <span
                        key={rp.permission.key}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        {rp.permission.key}
                      </span>
                    ))}
                    {role.rolePermissions.length > 6 ? (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        +{role.rolePermissions.length - 6} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditRole(role)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button size="sm" onClick={() => openAssignPerms(role)}>
                    <ShieldPlus className="mr-1.5 h-3.5 w-3.5" />
                    Assign
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </SuperAdminPageShell>

      <Dialog
        open={createRoleOpen}
        title="Create role"
        description="Define a new role that can be assigned permissions across modules."
        onClose={() => setCreateRoleOpen(false)}
        onConfirm={createHandleSubmit(handleCreateSubmit)}
        confirmLoading={createRoleSubmitting}
        confirmLabel="Create role"
      >
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <Label htmlFor="create-name">Role name</Label>
            <Input
              id="create-name"
              className="mt-1.5"
              placeholder="e.g. Finance Manager"
              {...createRegister('name')}
            />
            {createErrors.name ? <p className="mt-1 text-xs text-rose-600">{createErrors.name.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="create-description">Description</Label>
            <Input
              id="create-description"
              className="mt-1.5"
              placeholder="Summarize the purpose of this role"
              {...createRegister('description')}
            />
          </div>
        </form>
      </Dialog>

      <Dialog
        open={editRoleOpen}
        title="Edit role"
        description={editingRole ? `Update metadata for "${editingRole.name}".` : undefined}
        onClose={() => setEditRoleOpen(false)}
        onConfirm={editHandleSubmit(handleEditSave)}
        confirmLoading={editRoleSubmitting}
        confirmLabel="Save changes"
      >
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <Label htmlFor="edit-name">Role name</Label>
            <Input id="edit-name" className="mt-1.5" placeholder="Role name" {...editRegister('name')} />
            {editErrors.name ? <p className="mt-1 text-xs text-rose-600">{editErrors.name.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Input id="edit-description" className="mt-1.5" placeholder="Role description" {...editRegister('description')} />
          </div>
        </form>
      </Dialog>

      <Dialog
        open={assignPermsOpen}
        title="Assign permissions"
        description={assignRole ? `Manage the permission set assigned to "${assignRole.name}".` : undefined}
        onClose={() => setAssignPermsOpen(false)}
        onConfirm={handleAssignSave}
        confirmLoading={assignSubmitting}
        confirmLabel="Save permissions"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 text-sm text-slate-600">
            <span className="font-medium text-slate-900">{selectedPermissionKeys.length}</span> of{' '}
            <span className="font-medium text-slate-900">{permissions.length}</span> permissions selected
          </div>
          <div className="grid gap-3 sm:grid-cols-2 max-h-[50vh] overflow-y-auto pr-1">
            {permissions.map((permission) => {
              const checked = selectedPermissionKeys.includes(permission.key);
              return (
                <label
                  key={permission.key}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    onChange={() => togglePermission(permission.key)}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{permission.key}</p>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                      {permission.description ?? 'Platform permission from the RBAC catalog.'}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </Dialog>
    </>
  );
}
