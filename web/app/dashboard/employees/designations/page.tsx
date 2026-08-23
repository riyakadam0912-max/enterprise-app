'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/stores/auth-store';
import { useEmployeesByDesignation } from '@/hooks/useEmployees';
import { canManageDesignations } from '@/utils/auth/permissions';

export default function DesignationsPage() {
  const { grouped, loading, error } = useEmployeesByDesignation();
  const session = useAuthSession();
  const router = useRouter();
  const canManage = canManageDesignations(session.role);

  const sortedColumns = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Designations</h1>
          <p className="text-sm text-slate-500 mt-1">Employees grouped by designation</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/employees/add"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Add Employee
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : sortedColumns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <span className="text-5xl mb-3">🏷️</span>
          <p className="text-sm font-medium">No designations yet</p>
          <p className="text-xs mt-1">
            <Link href="/dashboard/employees/add" className="text-orange-500 hover:underline">
              Add employees with designations
            </Link>
          </p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {sortedColumns.map(([designation, cards]) => {
            const isUnassigned = designation === 'Unassigned';
            return (
              <div key={designation} className="shrink-0 w-64">
                <div className={`bg-white rounded-t-lg border-l-4 ${isUnassigned ? 'border-l-slate-400' : 'border-l-orange-500'} border-t border-r border-b-0 border-t-slate-200 border-r-slate-200 px-4 py-3 mb-1`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700 truncate pr-2" title={designation}>{designation}</span>
                    <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                      {cards.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {cards.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-b-lg rounded-tr-lg p-6 flex flex-col items-center justify-center text-center">
                      <div className="text-3xl mb-2 opacity-30">👤</div>
                      <p className="text-xs text-slate-400">No employees in {designation}</p>
                    </div>
                  ) : (
                    cards.map((emp, idx) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => canManage && router.push(`/dashboard/employees/edit/${emp.id}`)}
                        disabled={!canManage}
                        className={`w-full text-left bg-white border border-slate-200 px-4 py-3 hover:shadow-sm transition-shadow ${
                          idx === cards.length - 1 ? 'rounded-b-lg' : ''
                        } ${idx === 0 ? 'rounded-tr-lg' : ''} ${canManage ? 'cursor-pointer hover:border-orange-200' : 'cursor-default'}`}
                      >
                        <p className="text-sm font-semibold text-slate-900 truncate">{emp.name}</p>
                        {emp.department && (
                          <p className="text-xs text-orange-500 mt-0.5 truncate">{emp.department}</p>
                        )}
                        {emp.email && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{emp.email}</p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
