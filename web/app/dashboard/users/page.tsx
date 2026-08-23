'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/api/apiClient';
import {
  updateUserRole,
  activateUser,
  deactivateUser,
  deleteUser,
} from '@/api/usersApi';
import { useAuthSession } from '@/stores/auth-store';
import {
  canAccessUsers,
  canEditUsers,
  canDeleteUsers,
} from '@/utils/auth/permissions';

interface UserAccount {
  id: number;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'COMPLIANCE_MANAGER' | 'HR' | 'MANAGER' | 'EMPLOYEE';
  isActive: boolean;
  employeeId: number | null;
  managerId?: number | null;
  designation?: string | null;
  createdAt: string;
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
  ADMIN: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  COMPLIANCE_MANAGER: 'bg-blue-100 text-blue-700 border-blue-200',
  HR: 'bg-teal-100 text-teal-700 border-teal-200',
  MANAGER: 'bg-amber-100 text-amber-700 border-amber-200',
  EMPLOYEE: 'bg-slate-100 text-slate-700 border-slate-200',
};

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_BADGE_STYLES[role] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-semibold ${cls}`}>
      {role.replace('_', ' ')}
    </span>
  );
}

export default function UsersPage() {
  const session = useAuthSession();
  const role = session.role;
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningUserId, setActioningUserId] = useState<number | null>(null);

  const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.isSuperAdmin === true;
  const editable = canEditUsers(role);
  const deletable = canDeleteUsers(role);
  const canView = canAccessUsers(role);

  const roleOptions = isSuperAdmin
    ? ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER', 'HR', 'MANAGER', 'EMPLOYEE']
    : ['COMPLIANCE_MANAGER', 'HR', 'MANAGER', 'EMPLOYEE'];

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!canView) {
      setUsers([]);
      setError('You do not have permission to view user accounts.');
      setLoading(false);
      return;
    }

    try {
      const usersData = await apiClient<UserAccount[]>('/users');
      setUsers(usersData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [canView]);

  const handleRoleChange = async (user: UserAccount, nextRole: string) => {
    if (!editable || nextRole === user.role || user.id === session.user?.id) return;
    setActioningUserId(user.id);
    try {
      await updateUserRole(user.id, nextRole);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user role');
    } finally {
      setActioningUserId(null);
    }
  };

  const handleToggleActive = async (user: UserAccount) => {
    if (!editable || user.id === session.user?.id) return;
    setActioningUserId(user.id);
    try {
      if (user.isActive) {
        await deactivateUser(user.id);
      } else {
        await activateUser(user.id);
      }
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${user.isActive ? 'deactivate' : 'activate'} user`);
    } finally {
      setActioningUserId(null);
    }
  };

  const handleDelete = async (user: UserAccount) => {
    if (!deletable || user.id === session.user?.id) return;
    if (!window.confirm(`Permanently delete user ${user.name} (${user.email})? This cannot be undone.`)) return;
    setActioningUserId(user.id);
    try {
      await deleteUser(user.id);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete user');
    } finally {
      setActioningUserId(null);
    }
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            {editable
              ? 'Admin view of login accounts — create, edit, and manage roles'
              : 'Directory of login accounts'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <span className="text-4xl mb-3">🔐</span>
            <p className="text-sm font-medium">No user accounts yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                  {(editable || deletable) && (
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.id === session.user?.id;
                  const actioning = actioningUserId === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                            <span className="text-orange-600 text-xs font-bold">{u.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-slate-900 block">{u.name}</span>
                            {isSelf && (
                              <span className="text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-orange-500">{u.email}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{u.designation ?? '—'}</td>
                      <td className="px-6 py-4">
                        {editable && !isSelf ? (
                          <select
                            value={u.role}
                            disabled={actioning}
                            onChange={(event) => void handleRoleChange(u, event.target.value)}
                            aria-label={`Change role for ${u.name}`}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            {!roleOptions.includes(u.role) ? <option value={u.role}>{u.role}</option> : null}
                            {roleOptions.map((option) => <option key={option} value={option}>{option.replace('_', ' ')}</option>)}
                          </select>
                        ) : (
                          <RoleBadge role={u.role} />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      {(editable || deletable) && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {editable && !isSelf && (
                              <button
                                type="button"
                                onClick={() => void handleToggleActive(u)}
                                disabled={actioning}
                                title={u.isActive ? 'Deactivate user' : 'Activate user'}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${
                                  u.isActive
                                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                                    : 'text-green-700 bg-green-50 hover:bg-green-100 border border-green-200'
                                }`}
                              >
                                {actioning ? '…' : u.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                            {deletable && !isSelf && (
                              <button
                                type="button"
                                onClick={() => void handleDelete(u)}
                                disabled={actioning}
                                title="Delete user"
                                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50 border border-red-200"
                              >
                                {actioning ? '…' : 'Delete'}
                              </button>
                            )}
                            {!editable && !deletable && (
                              <span className="text-xs text-slate-400">Read-only</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
