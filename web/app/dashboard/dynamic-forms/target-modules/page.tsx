'use client';

import { useDynamicFormsByTargetModule } from '@/hooks/useDynamicForms';

const FIXED_MODULES = ['Sales', 'Events', 'Finance', 'HR', 'Operations'];

function EmptyCard({ module: mod }: { module: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-slate-400 text-sm">No Records in {mod}</p>
    </div>
  );
}

export default function TargetModulesPage() {
  const { grouped, loading, error } = useDynamicFormsByTargetModule();

  // Build column list: fixed order first, then any extra from data
  const extraModules = Object.keys(grouped).filter((m) => !FIXED_MODULES.includes(m));
  const columns = [...FIXED_MODULES, ...extraModules];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64 text-slate-400">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-500">{error}</div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Target Modules</h1>
        <p className="text-sm text-slate-500 mt-0.5">Forms grouped by their target module</p>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((mod) => {
          const items = grouped[mod] ?? [];
          return (
            <div
              key={mod}
              className="flex-none w-64 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Column header */}
              <div className="px-4 py-3 border-l-4 border-orange-500 bg-white">
                <h2 className="text-sm font-semibold text-slate-800">{mod}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{items.length} form{items.length !== 1 ? 's' : ''}</p>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-2 min-h-32">
                {items.length === 0 ? (
                  <EmptyCard module={mod} />
                ) : (
                  items.map((f) => (
                    <div
                      key={f.id}
                      className="bg-slate-50 hover:bg-slate-100 rounded-lg px-3 py-2.5 border border-slate-100 transition-colors"
                    >
                      <p className="text-sm font-bold text-orange-600 leading-tight">{f.formName}</p>
                      {f.formCode && (
                        <p className="text-xs text-green-600 mt-0.5">{f.formCode}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
