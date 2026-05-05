'use client';

import { useEffect, useState } from 'react';
import { getProjectsByStatus, Project } from '@/api/projectsApi';

const COLUMNS = ['On Hold', 'Completed', 'In Progress', 'Planned'];

export default function ProjectStatusesPage() {
  const [grouped, setGrouped] = useState<Record<string, Project[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjectsByStatus()
      .then(setGrouped)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Projects</h1>
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Projects</h1>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const cards = grouped[col] ?? [];
          return (
            <div key={col} className="shrink-0 w-64">
              {/* Column Header */}
              <div className="bg-white border-l-4 border-l-orange-500 border border-gray-200 rounded-t-lg px-4 py-3 mb-1">
                <span className="font-semibold text-gray-800 text-sm">{col}</span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {cards.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-400">
                    No Records
                  </div>
                ) : (
                  cards.map((p) => (
                    <div key={p.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
                      <p className="font-semibold text-gray-900 text-sm">{p.projectName}</p>
                      {p.projectCode && (
                        <p className="text-orange-500 text-xs mt-0.5">{p.projectCode}</p>
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
