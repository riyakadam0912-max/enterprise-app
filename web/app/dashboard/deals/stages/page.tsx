'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getDeals, Deal, DealStage } from '../../../../src/api/dealsApi';
import { formatInrCurrency } from '@/utils/formatCurrency';
import { reportError, retryAsync } from '@/lib/error-handling';

const STAGE_COLUMNS: DealStage[] = [
  'NEW',
  'QUALIFIED',
  'PROPOSAL',
  'WON',
  'LOST',
];

const STAGE_LABELS: Record<DealStage, string> = {
  NEW:         'New',
  QUALIFIED:   'Qualification',
  PROPOSAL:    'Proposal',
  WON:         'Closed Won',
  LOST:        'Closed Lost',
};

function EmptyIllustration() {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none" className="mb-3 opacity-30">
        <rect x="8" y="16" width="48" height="36" rx="4" stroke="#94a3b8" strokeWidth="2.5" fill="#f1f5f9" />
        <rect x="16" y="24" width="14" height="3" rx="1.5" fill="#94a3b8" />
        <rect x="16" y="31" width="20" height="3" rx="1.5" fill="#94a3b8" />
        <rect x="16" y="38" width="10" height="3" rx="1.5" fill="#94a3b8" />
        <circle cx="46" cy="18" r="8" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
        <path d="M46 14v4l3 2" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="text-xs text-gray-400">No deals in this stage</p>
    </div>
  );
}

export default function DealStagesPage() {
  const router = useRouter();
  const [deals, setDeals]       = useState<Deal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAsOpen, setShowAsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadDeals() {
      try {
        setDeals(await retryAsync(() => getDeals(), 2, 200));
      } catch (error) {
        reportError(error, 'Unable to load deals');
      } finally {
        setLoading(false);
      }
    }

    loadDeals();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowAsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const grouped: Record<DealStage, Deal[]> = Object.fromEntries(
    STAGE_COLUMNS.map((s) => [s, deals.filter((d) => d.stage === s)])
  ) as Record<DealStage, Deal[]>;

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-semibold text-gray-800">Stages</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard/deals/add')}
            className="w-7 h-7 flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white rounded text-lg leading-none font-bold"
            title="Add Deal"
          >
            +
          </button>

          {/* 3-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => { setMenuOpen((v) => !v); setShowAsOpen(false); }}
              className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
            >
              ···
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 w-44 bg-white border border-gray-200 rounded shadow-lg z-50 py-1 text-sm">
                <div
                  className="relative"
                  onMouseEnter={() => setShowAsOpen(true)}
                  onMouseLeave={() => setShowAsOpen(false)}
                >
                  <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center justify-between">
                    Show As <span className="text-gray-400">›</span>
                  </button>
                  {showAsOpen && (
                    <div className="absolute right-full top-0 w-36 bg-white border border-gray-200 rounded shadow-lg py-1 text-sm">
                      {['List', 'Calendar', 'Timeline', 'Spreadsheet', 'Kanban'].map((opt) => (
                        <button
                          key={opt}
                          className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center justify-between ${opt === 'Kanban' ? 'text-orange-600 font-medium' : ''}`}
                        >
                          {opt} {opt === 'Kanban' && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <hr className="my-1 border-gray-100" />
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50">Print</button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50">Import</button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50">Export</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Loading…
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGE_COLUMNS.map((stage) => {
            const cards = grouped[stage];
            return (
              <div
                key={stage}
                className="flex-none w-52 bg-gray-50 border border-gray-200 rounded-lg flex flex-col"
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5 font-medium">
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 min-h-24">
                  {cards.length === 0 ? (
                    <EmptyIllustration />
                  ) : (
                    cards.map((deal) => (
                      <div
                        key={deal.id}
                        className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => router.push('/dashboard/deals')}
                      >
                        <p className="text-sm font-medium text-gray-800 leading-tight mb-1">
                          {deal.title}
                        </p>
                        {deal.owner && (
                          <p className="text-xs text-gray-500">{deal.owner}</p>
                        )}
                        {deal.value != null && (
                          <p className="text-xs text-gray-400 mt-1">
                            {formatInrCurrency(deal.value, 2)}
                          </p>
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
