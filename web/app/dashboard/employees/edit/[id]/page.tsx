'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEmployee, editEmployee } from '@/hooks/useEmployees';
import { requestPasswordResetCode, resetUserPassword } from '@/api/usersApi';
import { useAuthSession } from '@/stores/auth-store';

const DEPARTMENTS = ['Sales', 'Finance', 'HR', 'IT', 'Operations', 'Marketing', 'Legal', 'Other'];
const STATUSES = ['Active', 'On Leave', 'Resigned', 'Terminated'];

export default function EditEmployeePage() {
  const params = useParams();
  const id = Number(params.id);
  const router = useRouter();

  const { employee, loading: fetching, error: fetchError } = useEmployee(id);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    department: '',
    designation: '',
    hireDate: '',
    manager: '',
    leaveBalance: '',
    status: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetState, setResetState] = useState({
    password: '',
    securityCode: '',
    sendingCode: false,
    resetting: false,
    requestMessage: '',
    resetMessage: '',
    requestError: '',
    resetError: '',
  });
  const authSession = useAuthSession();
  const isSelfEdit = authSession.employeeId === id;
  const canResetPasswords = authSession.isSuperAdmin || authSession.role === 'ADMIN';

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name,
        email: employee.email ?? '',
        phoneNumber: employee.phoneNumber ?? '',
        department: employee.department ?? '',
        designation: employee.designation ?? '',
        hireDate: employee.hireDate ? employee.hireDate.substring(0, 10) : '',
        manager: employee.manager ?? '',
        leaveBalance: employee.leaveBalance != null ? String(employee.leaveBalance) : '',
        status: employee.status ?? '',
      });
    }
  }, [employee]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    setSaving(true);
    try {
      await editEmployee(id, {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phoneNumber: form.phoneNumber.trim() || undefined,
        department: form.department || undefined,
        designation: form.designation.trim() || undefined,
        hireDate: form.hireDate || undefined,
        manager: form.manager.trim() || undefined,
        leaveBalance: form.leaveBalance ? Number(form.leaveBalance) : undefined,
        status: form.status || undefined,
      });
      router.push('/dashboard/employees');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestResetCode() {
    if (isSelfEdit) {
      setResetState((prev) => ({ ...prev, requestError: 'You cannot reset your own password here.' }));
      return;
    }

    setResetState((prev) => ({ ...prev, sendingCode: true, requestError: '', requestMessage: '' }));
    try {
      const response = await requestPasswordResetCode(id);
      setResetState((prev) => ({ ...prev, requestMessage: response.message }));
    } catch (err) {
      setResetState((prev) => ({ ...prev, requestError: err instanceof Error ? err.message : 'Unable to send the reset code.' }));
    } finally {
      setResetState((prev) => ({ ...prev, sendingCode: false }));
    }
  }

  async function handlePasswordResetSubmit(e: FormEvent) {
    e.preventDefault();

    if (isSelfEdit) {
      setResetState((prev) => ({ ...prev, resetError: 'You cannot change your own password here.' }));
      return;
    }

    if (!resetState.password || resetState.password.length < 8) {
      setResetState((prev) => ({ ...prev, resetError: 'New password must be at least 8 characters long.' }));
      return;
    }

    if (!resetState.securityCode.trim()) {
      setResetState((prev) => ({ ...prev, resetError: 'Security code is required.' }));
      return;
    }

    setResetState((prev) => ({ ...prev, resetting: true, resetError: '', resetMessage: '' }));

    try {
      const response = await resetUserPassword(id, {
        password: resetState.password,
        securityCode: resetState.securityCode.trim(),
      });
      setResetState((prev) => ({ ...prev, resetMessage: response.message, password: '', securityCode: '' }));
    } catch (err) {
      setResetState((prev) => ({ ...prev, resetError: err instanceof Error ? err.message : 'Unable to reset the password.' }));
    } finally {
      setResetState((prev) => ({ ...prev, resetting: false }));
    }
  }

  const inputCls = 'w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm';

  if (fetching) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{fetchError}</div>
        <Link href="/dashboard/employees" className="mt-4 inline-block text-sm text-orange-500 hover:underline">← Back to Employees</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/employees" className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Back">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Employee</h1>
          <p className="text-sm text-slate-500 mt-0.5">Update employee details</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {!isSelfEdit && canResetPasswords && (
          <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Password reset</h2>
                <p className="text-sm text-slate-600">Secure admin reset. Existing passwords are never displayed.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRequestResetCode}
                  disabled={resetState.sendingCode}
                  className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-60"
                >
                  {resetState.sendingCode ? 'Sending code…' : 'Send security code'}
                </button>
              </div>

              {resetState.requestMessage && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{resetState.requestMessage}</div>
              )}
              {resetState.requestError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{resetState.requestError}</div>
              )}

              <form onSubmit={handlePasswordResetSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
                  <input
                    type="password"
                    value={resetState.password}
                    onChange={(e) => setResetState((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Minimum 8 characters"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Security code</label>
                  <input
                    type="text"
                    value={resetState.securityCode}
                    onChange={(e) => setResetState((prev) => ({ ...prev, securityCode: e.target.value }))}
                    placeholder="Enter the 6-digit code"
                    className={inputCls}
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetState.resetting}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-700 disabled:opacity-60"
                >
                  {resetState.resetting ? 'Resetting…' : 'Reset password'}
                </button>

                {resetState.resetMessage && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{resetState.resetMessage}</div>
                )}
                {resetState.resetError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{resetState.resetError}</div>
                )}
              </form>
            </div>
          </div>
        )}

        {isSelfEdit && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You cannot change your own password from this screen.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="First Name" className={`${inputCls} border-orange-400`} />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="employee@company.com" className={inputCls} />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
            <input type="tel" name="phoneNumber" value={form.phoneNumber} onChange={handleChange} placeholder="81234 56789" className={inputCls} />
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <select name="department" value={form.department} onChange={handleChange} className={inputCls}>
              <option value="">-Select-</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Designation */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
            <input type="text" name="designation" value={form.designation} onChange={handleChange} placeholder="e.g. Software Engineer" className={inputCls} />
          </div>

          {/* Hire Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hire Date</label>
            <input type="date" name="hireDate" value={form.hireDate} onChange={handleChange} className={inputCls} />
          </div>

          {/* Manager */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Manager</label>
            <input type="text" name="manager" value={form.manager} onChange={handleChange} placeholder="Manager name" className={inputCls} />
          </div>

          {/* Leave Balance */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Leave Balance</label>
            <input type="number" name="leaveBalance" value={form.leaveBalance} onChange={handleChange} placeholder="#######" min="0" className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Shift</label>
            <input
              type="text"
              value={employee?.shift ? `${employee.shift.name} (${employee.shift.type})` : 'Unassigned'}
              readOnly
              className={`${inputCls} bg-slate-50 text-slate-600`}
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className={inputCls}>
              <option value="">-Select-</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <Link href="/dashboard/employees" className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
