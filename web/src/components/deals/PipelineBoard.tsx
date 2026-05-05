'use client';

import React, { useState } from 'react';
import { Deal, DealStage, Pipeline } from '../../api/dealsApi';
import { updateDeal } from '../../api/dealsApi';
import { formatInrCurrency } from '@/utils/formatCurrency';
import DealCard from './DealCard';

type StageKey = Lowercase<DealStage>;

const STAGE_COLUMNS: { key: StageKey; label: string; headerColor: string }[] = [
  { key: 'new',         label: 'NEW',         headerColor: 'bg-slate-200   text-slate-700' },
  { key: 'qualified',   label: 'QUALIFIED',   headerColor: 'bg-blue-100    text-blue-700'  },
  { key: 'proposal',    label: 'PROPOSAL',    headerColor: 'bg-purple-100  text-purple-700'},
  { key: 'won',         label: 'WON',         headerColor: 'bg-green-100   text-green-700' },
  { key: 'lost',        label: 'LOST',        headerColor: 'bg-red-100     text-red-700'   },
];

interface PipelineBoardProps {
  pipeline:   Pipeline;
  onRefetch:  () => void;
}

export default function PipelineBoard({ pipeline, onRefetch }: PipelineBoardProps) {
  const [draggingId,      setDraggingId]      = useState<number | null>(null);
  const [dragOverColumn,  setDragOverColumn]  = useState<StageKey | null>(null);
  const [movingId,        setMovingId]        = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, dealId: number) => {
    setDraggingId(dealId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, column: StageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  };

  const handleDrop = async (e: React.DragEvent, targetStage: StageKey) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggingId) return;

    const currentStage = Object.entries(pipeline).find(([, deals]) =>
      (deals as Deal[]).some((d) => d.id === draggingId)
    )?.[0] as StageKey | undefined;

    if (!currentStage || currentStage === targetStage) {
      setDraggingId(null);
      return;
    }

    setMovingId(draggingId);
    try {
      await updateDeal(draggingId, { stage: targetStage.toUpperCase() as DealStage });
      onRefetch();
    } finally {
      setMovingId(null);
      setDraggingId(null);
    }
  };

  const totalValue = Object.values(pipeline)
    .flat()
    .reduce((sum, d) => sum + (d as Deal).value, 0);

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Pipeline value:{' '}
        <span className="font-semibold text-slate-700">{formatInrCurrency(totalValue)}</span>
        {' '}· Drag cards to move them between stages
      </p>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGE_COLUMNS.map(({ key, label, headerColor }) => {
          const columnDeals = (pipeline[key] ?? []) as Deal[];
          const colValue    = columnDeals.reduce((s, d) => s + d.value, 0);
          const isOver      = dragOverColumn === key;

          return (
            <div
              key={key}
              onDragOver={(e) => handleDragOver(e, key)}
              onDrop={(e) => handleDrop(e, key)}
              onDragLeave={() => setDragOverColumn(null)}
              className={`shrink-0 w-64 flex flex-col rounded-xl border transition-colors ${
                isOver
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${headerColor}`}>
                <span className="text-xs font-bold tracking-wide">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{columnDeals.length}</span>
                  <span className="text-xs opacity-70">{formatInrCurrency(colValue)}</span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 p-2 min-h-32">
                {columnDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className={`transition-opacity ${movingId === deal.id ? 'opacity-40' : 'opacity-100'}`}
                  >
                    <DealCard deal={deal} onDragStart={handleDragStart} />
                  </div>
                ))}
                {isOver && draggingId && (
                  <div className="border-2 border-dashed border-orange-300 rounded-xl h-20 flex items-center justify-center text-xs text-orange-400">
                    Drop here
                  </div>
                )}
                {columnDeals.length === 0 && !isOver && (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-300 select-none h-16">
                    No deals
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
