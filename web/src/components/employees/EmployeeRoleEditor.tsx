'use client';

import { useState } from 'react';
import { updateUserRole } from '@/api/usersApi';
import { useAuthSession } from '@/stores/auth-store';
import { canEditUsers } from '@/utils/auth/permissions';
import type { Employee } from '@/types/entities';

export function EmployeeRoleEditor({ user, disabled = false }: {
  user: Employee['user'];
  disabled?: boolean;
}) {
  const session = useAuthSession();
  const [savedRole, setSavedRole] = useState(user?.role ?? '');
  const [role, setRole] = useState(user?.role ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.isSuperAdmin;
  const hasPermission = isSuperAdmin || session.role === 'ADMIN' || session.isPlatformAdmin ||
    session.permissions.includes('user.update');
  const isSelf = user?.id === session.user?.id;
  const canChangeRole = canEditUsers(session.role) && hasPermission && !isSelf;
  const roleOptions = isSuperAdmin
    ? ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER', 'HR', 'MANAGER', 'EMPLOYEE']
    : ['COMPLIANCE_MANAGER', 'HR', 'MANAGER', 'EMPLOYEE'];

  async function handleUpdateRole() {
    if (!user || !canChangeRole || !roleOptions.includes(role) || role === savedRole || saving || disabled) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateUserRole(user.id, role);
      setSavedRole(updated.role);
      setRole(updated.role);
      setMessage('Role updated successfully.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update the role.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3" aria-labelledby="employee-role-heading">
      <div>
        <h2 id="employee-role-heading" className="text-base font-semibold text-slate-900">Account role</h2>
        <p className="text-sm text-slate-600">Choose Manager to let this employee manage a team. Assign team members using their Reporting to field.</p>
      </div>
      {!user ? (
        <p className="text-sm text-slate-600">This employee needs a linked login account before a role can be assigned.</p>
      ) : (
        <>
          <label htmlFor="employee-account-role" className="block text-sm font-medium text-slate-700">Role</label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              id="employee-account-role"
              value={role}
              onChange={(event) => { setRole(event.target.value); setError(null); setMessage(null); }}
              disabled={!canChangeRole || saving || disabled || !savedRole}
              className="min-w-48 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 disabled:opacity-60"
            >
              {!roleOptions.includes(savedRole) && <option value={savedRole}>{savedRole.replaceAll('_', ' ') || 'Unavailable'}</option>}
              {roleOptions.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
            </select>
            {canChangeRole && (
              <button
                type="button"
                onClick={handleUpdateRole}
                disabled={saving || disabled || !savedRole || role === savedRole}
                className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {saving ? 'Updating role…' : 'Update role'}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {isSelf ? 'You cannot change your own role.' : !canChangeRole
              ? 'You do not have permission to change account roles.'
              : 'Use Update role to save this change separately from employee details.'}
          </p>
        </>
      )}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
