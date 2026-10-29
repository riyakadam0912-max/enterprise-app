'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/stores/auth-store';
import { useEmployees, removeEmployee } from '@/hooks/useEmployees';
import TableActions from '@/components/common/TableActions';

export default function EmployeesPage() {
  const session = useAuthSession();
  const isManager = session.role === 'MANAGER';
  const { employees, loading, error, refetch } = useEmployees();
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return employees;
    return employees.filter((employee) => [employee.name, employee.email, employee.department, employee.designation, employee.organization?.name].some((value) => value?.toLowerCase().includes(normalizedQuery)));
  }, [employees, query]);

  const activeEmployees = employees.filter((employee) => (employee.status ?? 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
  const linkedAccounts = employees.filter((employee) => employee.user).length;

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    setDeletingId(id);
    setDeleteError(null);
    try { await removeEmployee(id); await refetch(); } catch (err) { setDeleteError(err instanceof Error ? err.message : 'Delete failed'); } finally { setDeletingId(null); }
  }

  return (
    <div className="min-h-full bg-slate-50/60 p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">Employee Management</h1><p className="mt-1 text-sm text-slate-500">People, employment details, and account access in one place.</p></div>
        <div className="flex items-center gap-2">{!isManager && <Link href="/dashboard/employees/add" className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600"><span className="text-base leading-none">+</span>Add employee</Link>}<TableActions moduleKey="employees" rows={employees} onRefresh={refetch} /></div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">{[['Total people', employees.length], ['Active employees', activeEmployees], ['Linked accounts', linkedAccounts]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{value}</p></div>)}</div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{deleteError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold text-slate-950">People directory</h2><p className="mt-0.5 text-xs text-slate-500">Keep employment and access information together.</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" aria-label="Search employees" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white sm:w-64" /></div>
        {loading ? <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-slate-700" /></div> : filteredEmployees.length === 0 ? <div className="flex flex-col items-center justify-center py-16 text-slate-400"><p className="text-sm font-medium">{employees.length === 0 ? 'No employees yet' : 'No people match your search'}</p>{employees.length === 0 && <Link href="/dashboard/employees/add" className="mt-2 text-xs text-slate-700 hover:underline">Add the first employee</Link>}</div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{['Employee', 'Organization', 'Role', 'Account', 'Status', 'Hire date'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</th>)}<th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredEmployees.map((emp) => <tr key={emp.id} className="transition hover:bg-slate-50"><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100"><span className="text-xs font-bold text-slate-600">{emp.name.charAt(0).toUpperCase()}</span></div><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{emp.name}</p><p className="truncate text-xs text-slate-500">{emp.email ?? 'No email'}</p></div></div></td><td className="px-4 py-4 text-sm text-slate-600">{emp.organization?.name ?? '—'}</td><td className="px-4 py-4 text-sm text-slate-600"><span>{emp.designation ?? '—'}</span><span className="block text-xs text-slate-400">{emp.department ?? '—'}</span></td><td className="px-4 py-4 text-sm">{emp.user ? <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Linked account</span> : <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">No account</span>}</td><td className="px-4 py-4 text-sm"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${(emp.status ?? 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{(emp.status ?? 'ACTIVE').toLowerCase()}</span></td><td className="px-4 py-4 text-sm text-slate-600">{emp.hireDate ? new Date(emp.hireDate).toLocaleDateString() : '—'}</td><td className="px-4 py-4 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => router.push(`/dashboard/employees/edit/${emp.id}`)} className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200">Edit</button><button onClick={() => handleDelete(emp.id)} disabled={deletingId === emp.id} className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50">{deletingId === emp.id ? 'Deleting…' : 'Delete'}</button></div></td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}
