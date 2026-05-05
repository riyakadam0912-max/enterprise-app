'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePipeline } from '@/hooks/useDeals';
import PipelineBoard from '@/components/pipeline/PipelineBoard';
import { formatInrCurrency } from '@/utils/formatCurrency';

const PIPELINE_ORDER = ['new', 'qualified', 'proposal', 'won', 'lost'] as const;

export default function PipelinePage() {
  const { data: pipeline, loading, error, refetch } = usePipeline();
  const pipelineStats = useMemo(() => {
    if (!pipeline) {
      return {
        totalCount: 0,
        totalValue: 0,
        wonValue: 0,
        openCount: 0,
      };
    }

    const groups = PIPELINE_ORDER.map((key) => {
      const deals = pipeline[key] ?? [];
      return {
        key,
        count: deals.length,
        value: deals.reduce((sum, deal) => sum + deal.value, 0),
      };
    });

    return {
      totalCount: groups.reduce((sum, item) => sum + item.count, 0),
      totalValue: groups.reduce((sum, item) => sum + item.value, 0),
      wonValue: groups.find((item) => item.key === 'won')?.value ?? 0,
      openCount: groups.filter((item) => item.key !== 'won' && item.key !== 'lost').reduce((sum, item) => sum + item.count, 0),
    };
  }, [pipeline]);

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Pipeline Board</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Move deals through stages like a real sales team</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Drag cards to update stage, watch value move by column, and keep the board as the primary sales workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/deals"
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              List View
            </Link>
            <Link
              href="/dashboard/deals/add"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-orange-200 transition-colors hover:bg-orange-600"
            >
              <span className="text-base leading-none">+</span>
              Add Deal
            </Link>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open deals</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{pipelineStats.openCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total pipeline</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{formatInrCurrency(pipelineStats.totalValue)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Won value</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{formatInrCurrency(pipelineStats.wonValue)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total cards</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{pipelineStats.totalCount}</p>
          </div>
        </div>
      </section>

      {loading && (
        <div className="flex h-60 items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {pipeline && (
        <PipelineBoard pipeline={pipeline} onRefetch={refetch} />
      )}
    </div>
  );
}
