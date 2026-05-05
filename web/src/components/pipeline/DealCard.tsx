'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Deal } from '@/api/dealsApi';
import { formatInrCurrency } from '@/utils/formatCurrency';

interface DealCardProps {
  deal: Deal;
}

export default function DealCard({ deal }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(deal.id),
    data: {
      dealId: deal.id,
      stage: deal.stage,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const leadName = deal.lead?.name ?? 'Unknown lead';
  const closeDate = deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : 'No close date';
  const probability = `${Math.round((deal.probability ?? 0) * 100)}%`;
  const value = formatInrCurrency(deal.value ?? 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition ${
        isDragging ? 'opacity-60' : 'opacity-100'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{deal.title}</p>
          <p className="mt-1 text-xs text-slate-500">{leadName}</p>
        </div>
        <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600">
          {probability}
        </span>
      </div>

      <p className="mt-3 text-sm font-bold text-orange-500">{value}</p>

      <div className="mt-2 space-y-0.5">
        <p className="text-xs text-slate-500">Assigned: {deal.owner ?? 'Unassigned'}</p>
        <p className="text-xs text-slate-500">Close: {closeDate}</p>
      </div>
    </div>
  );
}