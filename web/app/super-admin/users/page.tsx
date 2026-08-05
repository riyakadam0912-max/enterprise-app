'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { activateUser, createUser, deactivateUser, deleteUser, listUsers, type UserRecord } from '@/api/usersApi';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/providers/toast-provider';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', password: '', role: 'EMPLOYEE' });
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [actioningUserId, setActioningUserId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load users';
      toast.error('Users unavailable', message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !normalizedQuery || [user.name, user.email, user.role].join(' ').toLowerCase().includes(normalizedQuery);
      const matchesRole = !roleFilter || user.role.toUpperCase() === roleFilter.toUpperCase();
      const matchesStatus = !statusFilter || (statusFilter === 'active' ? user.isActive : !user.isActive);
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [query, roleFilter, statusFilter, users]);

  const handleInviteSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittingInvite(true);
    try {
      await createUser({
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
        password: inviteForm.password.trim(),
        role: inviteForm.role,
      });
      toast.success('User invited', `${inviteForm.name.trim()} can now sign in.`);
      setInviteOpen(false);
      setInviteForm({ name: '', email: '', password: '', role: 'EMPLOYEE' });
      await loadUsers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to invite user';
      toast.error('Invitation failed', message);
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleToggleStatus = async (user: UserRecord) => {
    setActioningUserId(user.id);
    try {
      if (user.isActive) {
        await deactivateUser(user.id);
        toast.success('Account updated', `${user.name} has been deactivated.`);
      } else {
        await activateUser(user.id);
        toast.success('Account updated', `${user.name} has been activated.`);
      }
      await loadUsers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change status';
      toast.error('Status update failed', message);
    } finally {
      setActioningUserId(null);
    }
  };

  const handleDelete = async (user: UserRecord) => {
    if (!window.confirm(`Delete ${user.name}? This action cannot be undone.`)) {
      return;
    }

    setActioningUserId(user.id);
    try {
      await deleteUser(user.id);
      toast.success('User removed', `${user.name} has been deleted.`);
      await loadUsers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete user';
      toast.error('Deletion failed', message);
    } finally {
      setActioningUserId(null);
    }
  };

  return (
    <SuperAdminPageShell title="User management" description="Coordinate users, roles, and access across the platform." actions={<Button onClick={() => setInviteOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Invite user</Button>}>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <Card className="border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search users or emails" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-10" />
          </div>
        </Card>
        <Card className="border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="EMPLOYEE">Employee</option>
          </Select>
        </Card>
        <Card className="border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Card>
      </div>

      <Card className="overflow-hidden border-slate-200/80 bg-white/80 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Manager</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Loading users…</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">No users match your filters.</td></tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="transition hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">{user.name.split(' ').slice(0, 2).map((part) => part[0]).join('')}</div>
                      <div>
                        <p className="font-semibold text-slate-900">{user.name}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{user.role}</span></td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{user.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-4 text-slate-700">{user.manager?.name ?? '—'}</td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" loading={actioningUserId === user.id} onClick={() => handleToggleStatus(user)}>
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="destructive" loading={actioningUserId === user.id} onClick={() => handleDelete(user)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {inviteOpen ? (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_32px_80px_-24px_rgba(15,23,42,0.45)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Invite a user</h3>
                <p className="mt-1 text-sm text-slate-500">Create a real account and grant the appropriate role immediately.</p>
              </div>
              <button type="button" onClick={() => setInviteOpen(false)} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
                <Input required value={inviteForm.name} onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))} placeholder="Alex Morgan" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                <Input type="email" required value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} placeholder="alex@company.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Temporary password</label>
                <Input type="password" required value={inviteForm.password} onChange={(event) => setInviteForm((current) => ({ ...current, password: event.target.value }))} placeholder="Minimum 6 characters" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
                <Select value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="HR">HR</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button type="submit" loading={submittingInvite}>Create account</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </SuperAdminPageShell>
  );
}
