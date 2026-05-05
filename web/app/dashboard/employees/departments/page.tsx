'use client';

import Link from 'next/link';
import { useEmployeesByDepartment } from '@/hooks/useEmployees';

const DEPT_COLUMNS = ['Sales', 'Engineering', 'HR', 'Finance', 'Operations'];

export default function DepartmentsPage() {
  const { grouped, loading, error } = useEmployeesByDepartment();

  const otherColumns = Object.entries(grouped)
    .filter(([department]) => !DEPT_COLUMNS.includes(department))
    .flatMap(([, employees]) => employees);

  const columns = [
    ...DEPT_COLUMNS.map((department) => ({ department, cards: grouped[department] ?? [] })),
  ];

  if (otherColumns.length > 0) {
    columns.push({ department: 'Other', cards: otherColumns });
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-1">Employees grouped by department</p>
        </div>
        <Link
          href="/dashboard/employees/add"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Add Employee
        </Link>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map(({ department, cards }) => {
            return (
              <div key={department} className="shrink-0 w-64">
                {/* Column header */}
                <div className="bg-white rounded-t-lg border-l-4 border-l-orange-500 border-t border-r border-b-0 border-t-slate-200 border-r-slate-200 px-4 py-3 mb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">{department}</span>
                    <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                      {cards.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {cards.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-b-lg rounded-tr-lg p-6 flex flex-col items-center justify-center text-center">
                      <div className="text-3xl mb-2 opacity-30">👤</div>
                      <p className="text-xs text-slate-400">No Records in {department}</p>
                    </div>
                  ) : (
                    cards.map((emp, idx) => (
                      <div
                        key={emp.id}
                        className={`bg-white border border-slate-200 px-4 py-3 hover:shadow-sm transition-shadow ${
                          idx === cards.length - 1 ? 'rounded-b-lg' : ''
                        } ${idx === 0 ? 'rounded-tr-lg' : ''}`}
                      >
                        <p className="text-sm font-semibold text-slate-900 truncate">{emp.name}</p>
                        {emp.designation && (
                          <p className="text-xs text-orange-500 mt-0.5 truncate">{emp.designation}</p>
                        )}
                      </div>
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
