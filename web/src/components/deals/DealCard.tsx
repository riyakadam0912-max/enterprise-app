'use client';

import React from 'react';
import { Deal, DealStage } from '../../api/dealsApi';
import { formatInrCurrency } from '@/utils/formatCurrency';

const STAGE_STYLES: Record<DealStage, string> = {
  NEW:         'bg-slate-100 text-slate-600',
  QUALIFIED:   'bg-blue-100 text-blue-700',
  PROPOSAL:    'bg-purple-100 text-purple-700',
  WON:         'bg-green-100 text-green-700',
  LOST:        'bg-red-100 text-red-700',
};

interface DealCardProps {
  deal: Deal;
  /** Called when the user drags this card — provide dragStart handler */
  onDragStart?: (e: React.DragEvent, dealId: number) => void;
}

export default function DealCard({ deal, onDragStart }: DealCardProps) {
  const stageStyle = STAGE_STYLES[deal.stage] ?? 'bg-slate-100 text-slate-600';

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart ? (e) => onDragStart(e, deal.id) : undefined}
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-slate-800 leading-tight">{deal.title}</p>
        <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${stageStyle}`}>
          {deal.stage}
        </span>
      </div>

      <p className="text-base font-bold text-orange-500 mb-3">
        {formatInrCurrency(deal.value)}
      </p>

      <div className="space-y-1 text-xs text-slate-500">
        {deal.lead && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>{deal.lead.name}{deal.lead.company ? ` · ${deal.lead.company}` : ''}</span>
          </div>
        )}
        {deal.owner && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>{deal.owner}</span>
          </div>
        )}
        {deal.probability != null && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>{(deal.probability * 100).toFixed(0)}% probability</span>
          </div>
        )}
        {deal.closeDate && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{new Date(deal.closeDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
