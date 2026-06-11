'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getCampaignLeads, CampaignLeadRow } from '@/api/campaignLeadsApi';
import { reportError } from '@/lib/error-handling';

const SOURCE_TYPES = ['Page Visit', 'Click', 'Email Open', 'Form Submission'];

const COL_STYLE: Record<string, { header: string; accent: string }> = {
  'Page Visit':       { header: 'border-l-4 border-orange-500', accent: 'text-orange-500' },
  'Click':            { header: 'border-l-4 border-purple-600', accent: 'text-purple-600' },
  'Email Open':       { header: 'border-l-4 border-emerald-500', accent: 'text-emerald-500' },
  'Form Submission':  { header: 'border-l-4 border-red-500', accent: 'text-red-500' },
};

const SHOW_AS_OPTIONS = ['List', 'Calendar', 'Timeline', 'Spreadsheet', 'Kanban'] as const;

function EmptyColumn({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
      <svg className="w-14 h-14 mb-2 opacity-40" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="8" y="12" width="30" height="38" rx="3"/>
        <path d="M20 28 h14 M20 34 h10"/>
        <circle cx="48" cy="48" r="10"/>
        <line x1="43" y1="48" x2="53" y2="48"/>
        <line x1="48" y1="43" x2="48" y2="53"/>
        <line x1="41" y1="55" x2="38" y2="58"/>
      </svg>
      <p className="text-sm font-medium">No Records in {label}</p>
    </div>
  );
}

export default function SourceTypesPage() {
  const [rows, setRows] = useState<CampaignLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAsOpen, setShowAsOpen] = useState(false);
  const [activeView, setActiveView] = useState('Kanban');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadCampaignLeads() {
      try {
        setRows(await getCampaignLeads());
      } catch (error) {
        reportError(error, 'Unable to load campaign leads');
      } finally {
        setLoading(false);
      }
    }

    loadCampaignLeads();
  }, []);

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

  const getColRows = (sourceType: string) =>
    rows.filter((r) => r.sourceType === sourceType);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Source Types</h1>
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
        <div className="flex gap-4 overflow-x-auto pb-4">
          {SOURCE_TYPES.map((sourceType) => {
            const colRows = getColRows(sourceType);
            const styles = COL_STYLE[sourceType];
            return (
              <div key={sourceType} className="bg-white rounded-xl border border-slate-200 shadow-sm min-w-72 shrink-0 overflow-hidden">
                {/* Column header */}
                <div className={`px-4 py-3 ${styles.header} bg-white flex items-center gap-2`}>
                  <span className={`font-semibold text-sm ${styles.accent}`}>{sourceType}</span>
                </div>

                {/* Cards */}
                <div className="p-3 space-y-3 min-h-20">
                  {colRows.length === 0 ? (
                    <EmptyColumn label={sourceType} />
                  ) : colRows.map((row) => (
                    <div
                      key={row.id}
                      className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:border-orange-300 transition-colors"
                    >
                      <div className="text-xs font-medium text-slate-800 leading-snug mb-1">
                        {row.campaign}
                      </div>
                      {row.lead && (
                        <div className="text-xs text-orange-600 font-medium">{row.lead.name}</div>
                      )}
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
