'use client';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { DealStage, Pipeline, updateDeal } from '@/api/dealsApi';
import PipelineColumn from './PipelineColumn';

const STAGES: DealStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

interface PipelineBoardProps {
  pipeline: Pipeline;
  onRefetch: () => Promise<void> | void;
}

export default function PipelineBoard({ pipeline, onRefetch }: PipelineBoardProps) {
  const onDragEnd = async (event: DragEndEvent) => {
    const activeId = Number(event.active.id);
    const overId = event.over?.id as DealStage | undefined;

    if (!overId || Number.isNaN(activeId)) return;

    const sourceStage = event.active.data.current?.stage as DealStage | undefined;

    if (!sourceStage || sourceStage === overId) return;

    await updateDeal(activeId, { stage: overId });
    await onRefetch();
  };

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const key = stage.toLowerCase() as Lowercase<DealStage>;
          const deals = pipeline[key] ?? [];
          return <PipelineColumn key={stage} stage={stage} deals={deals} />;
        })}
      </div>
    </DndContext>
  );
}