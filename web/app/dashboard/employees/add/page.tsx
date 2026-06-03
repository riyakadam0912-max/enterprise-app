'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addEmployee, removeEmployee } from '@/hooks/useEmployees';
import { apiClient } from '@/api/apiClient';
import { canAccessUsers } from '@/utils/auth/permissions';

const DEPARTMENTS = ['Sales', 'Engineering', 'HR', 'Finance', 'Operations'] as const;
const ROLES = ['EMPLOYEE', 'MANAGER', 'HR'] as const;

type CurrentUserRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

interface ManagerOption {
  id: number;
  name: string;
  role: string;
}

export default function AddEmployeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
  const [currentRole] = useState<CurrentUserRole>(() => {
    if (typeof window === 'undefined') {
      return 'EMPLOYEE';
    }

    return (localStorage.getItem('role') ?? 'EMPLOYEE') as CurrentUserRole;
  });

  const [form, setForm] = useState({
    name: '',
    department: '',
    designation: '',
    hireDate: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    reportingManagerId: '',
  });
  const selectedRole = form.role;

  useEffect(() => {
    if (typeof window === 'undefined' || !canAccessUsers(currentRole)) {
      setManagerOptions([]);
      return;
    }

    apiClient<ManagerOption[]>('/users')
      .then((users) => setManagerOptions(users.filter((user) => user.role === 'MANAGER')))
      .catch(() => setManagerOptions([]));
  }, [currentRole]);

  const inputCls = 'w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm';
  const selectCls = inputCls;

  const canCreateLogin = currentRole === 'ADMIN';
  const selectedReportingManager = useMemo(
    () => managerOptions.find((manager) => String(manager.id) === form.reportingManagerId) ?? null,
    [form.reportingManagerId, managerOptions],
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;

    setForm((prev) => {
      if (name === 'role') {
        return {
          ...prev,
          role: value,
          reportingManagerId: value === 'MANAGER' ? '' : prev.reportingManagerId,
        };
      }

      return { ...prev, [name]: value };
    });
  }

  function handleReset() {
    setForm({
      name: '',
      department: '',
      designation: '',
      hireDate: '',
      email: '',
      password: '',
      role: 'EMPLOYEE',
      reportingManagerId: '',
    });
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    if (canCreateLogin) {
      if (!form.email.trim()) {
        setError('Email is required.');
        return;
      }
      if (!form.password || form.password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
    }

    setLoading(true);
    let createdEmployeeId: number | null = null;

    try {
      const employee = await addEmployee({
        name: form.name.trim(),
        email: canCreateLogin ? form.email.trim() : undefined,
        department: form.department || undefined,
        designation: form.designation.trim() || undefined,
        hireDate: form.hireDate || undefined,
        manager: selectedReportingManager?.name || undefined,
        status: 'Active',
      });

      createdEmployeeId = employee.id;

      if (canCreateLogin) {
        try {
          const userPayload = {
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            role: form.role,
            employeeId: employee.id,
            ...(form.reportingManagerId ? { managerId: Number(form.reportingManagerId) } : {}),
          };

          await apiClient('/users', {
            method: 'POST',
            body: JSON.stringify(userPayload),
          });
        } catch {
          await removeEmployee(createdEmployeeId);
          setError('Employee profile created but login account failed. Please go to Users page to create login manually.');
          return;
        }
      }

      if (typeof window !== 'undefined') {
        window.alert('Employee created successfully.');
      }
      router.push('/dashboard/employees');
    } catch (err) {
      if (createdEmployeeId) {
        await removeEmployee(createdEmployeeId).catch(() => undefined);
      }
      setError(err instanceof Error ? err.message : 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/employees" className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Back">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Employee</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create a new employee record and login account</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Full name"
              className={`${inputCls} border-orange-400`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <select name="department" value={form.department} onChange={handleChange} className={selectCls}>
              <option value="">-Select-</option>
              {DEPARTMENTS.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
            <input
              type="text"
              name="designation"
              value={form.designation}
              onChange={handleChange}
              placeholder="e.g. Software Engineer"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hire Date</label>
            <input
              type="date"
              name="hireDate"
              value={form.hireDate}
              onChange={handleChange}
              className={inputCls}
            />
          </div>

          <div className="border-t border-slate-200 pt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">Create Login Account</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="user@company.com"
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Minimum 8 characters"
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select name="role" value={form.role} onChange={handleChange} className={selectCls}>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRole !== 'MANAGER' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reporting Manager</label>
                  <p className="text-xs text-slate-500 mb-1">(Optional — managers do not need a reporting manager)</p>
                  <select name="reportingManagerId" value={form.reportingManagerId} onChange={handleChange} className={selectCls}>
                    <option value="">No manager</option>
                    {managerOptions.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Creating...' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
