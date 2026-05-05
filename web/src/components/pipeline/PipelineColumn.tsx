'use client';

import { useDroppable } from '@dnd-kit/core';
import { Deal } from '@/api/dealsApi';
import { formatInrCurrency } from '@/utils/formatCurrency';
import DealCard from './DealCard';

interface PipelineColumnProps {
  stage: string;
  deals: Deal[];
}

export default function PipelineColumn({ stage, deals }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    data: { stage },
  });
  const columnValue = deals.reduce((total, deal) => total + deal.value, 0);

  return (
    <div className="w-80 shrink-0 rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex items-start justify-between rounded-t-3xl border-b border-slate-200 bg-white px-4 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{stage}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{deals.length} deals</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-400">Value</p>
          <p className="text-sm font-semibold text-slate-900">{formatInrCurrency(columnValue)}</p>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-44 flex-col gap-3 p-3 transition ${isOver ? 'bg-orange-50' : 'bg-slate-50'}`}
      >
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {deals.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">No deals</p>}
      </div>
    </div>
  );
}
