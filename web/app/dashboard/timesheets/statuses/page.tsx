'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getTimesheetsReport, TimesheetRow } from '@/api/timesheetsApi';

const COLUMNS = ['Submitted', 'Approved', 'Rejected'] as const;
type ColStatus = typeof COLUMNS[number];

const COL_STYLE: Record<ColStatus, { header: string; card: string }> = {
  Submitted: { header: 'border-l-4 border-red-500',    card: 'border-l-2 border-red-300' },
  Approved:  { header: 'border-l-4 border-purple-600',  card: 'border-l-2 border-purple-400' },
  Rejected:  { header: 'border-l-4 border-emerald-500', card: 'border-l-2 border-emerald-400' },
};

const SHOW_AS_OPTIONS = ['List', 'Calendar', 'Timeline', 'Spreadsheet', 'Kanban'] as const;

export default function StatusesPage() {
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAsOpen, setShowAsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<string>('Kanban');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTimesheetsReport({ limit: 200 })
      .then((r) => setRows(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowAsOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getColRows = (col: ColStatus) =>
    rows.filter((r) => r.status.toUpperCase() === col.toUpperCase());

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Statuses</h1>
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded text-slate-500 hover:bg-slate-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          <button className="w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
          </button>

          {/* 3-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => { setMenuOpen((o) => !o); setShowAsOpen(false); }}
              className="p-1.5 rounded text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-52 py-1 text-sm text-slate-700">

                {/* Show As */}
                <div
                  className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 cursor-pointer font-medium"
                  onClick={() => setShowAsOpen((o) => !o)}
                >
                  <span>Show As</span>
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>

                {showAsOpen && (
                  <div className="border-t border-slate-100 py-1">
                    {SHOW_AS_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { setActiveView(opt); setMenuOpen(false); setShowAsOpen(false); }}
                        className="w-full flex items-center justify-between px-6 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <span>{opt}</span>
                        {activeView === opt && (
                          <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className="border-t border-slate-100 my-1"/>

                <button className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 font-medium">
                  <span>Print</span>
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-slate-50 font-medium">Import</button>
                <button className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 font-medium">
                  <span>Export</span>
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Loading…</p>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {COLUMNS.map((col) => {
            const colRows = getColRows(col);
            const styles = COL_STYLE[col];
            return (
              <div key={col} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Column header */}
                <div className={`px-4 py-3 ${styles.header} bg-white`}>
                  <h3 className="font-semibold text-slate-700 text-sm">{col}</h3>
                </div>
                {/* Cards */}
                <div className="min-h-20 p-3 space-y-3">
                  {colRows.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No records</p>
                  ) : colRows.map((row) => (
                    <div
                      key={row.id}
                      className={`bg-white border border-slate-100 rounded-lg p-3 ${styles.card} shadow-sm`}
                    >
                      <div className="text-xs text-slate-500 mb-1">
                        {row.employee ? row.employee.id : (row.employeeId ?? '')}
                      </div>
                      <div className="text-xs font-medium text-orange-600 leading-snug">
                        {row.task}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
