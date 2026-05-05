'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEmployees, removeEmployee } from '@/hooks/useEmployees';
import TableActions from '@/components/common/TableActions';

export default function EmployeesPage() {
  const { employees, loading, error, refetch } = useEmployees();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      await removeEmployee(id);
      await refetch();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Employees</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your team members</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/employees/add"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Add Employee
          </Link>
          <TableActions moduleKey="employees" rows={employees} onRefresh={refetch} />
        </div>
      </div>

      {/* Error banners */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {deleteError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {deleteError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <span className="text-4xl mb-3">👥</span>
            <p className="text-sm font-medium">No employees yet</p>
            <p className="text-xs mt-1">
              <Link href="/dashboard/employees/add" className="text-orange-500 hover:underline">
                Add the first employee
              </Link>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone Number</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Hire Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Manager</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Shift</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Leave Balance</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500">{emp.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                          <span className="text-orange-600 text-xs font-bold">
                            {emp.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-orange-500">{emp.email ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{emp.phoneNumber ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{emp.department ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{emp.designation ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {emp.hireDate ? new Date(emp.hireDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{emp.manager ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {emp.shift ? `${emp.shift.name} (${emp.shift.type})` : 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {emp.leaveBalance != null ? emp.leaveBalance : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/employees/edit/${emp.id}`)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id)}
                          disabled={deletingId === emp.id}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
                        >
                          {deletingId === emp.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
