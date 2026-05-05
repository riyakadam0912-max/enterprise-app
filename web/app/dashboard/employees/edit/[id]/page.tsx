'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEmployee, editEmployee } from '@/hooks/useEmployees';

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
