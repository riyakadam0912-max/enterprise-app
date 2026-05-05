'use client';

import ChartSkeleton from './ChartSkeleton';

export default function DashboardChartsSkeleton() {
  return (
    <>
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="h-4 w-44 rounded bg-slate-200 animate-pulse" />
            <div className="mt-2 h-5 w-64 rounded bg-slate-100 animate-pulse" />
            <div className="mt-2 h-3 w-96 max-w-full rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-28 rounded-xl bg-slate-200 animate-pulse" />
            <div className="h-10 w-28 rounded-xl bg-slate-200 animate-pulse" />
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
          <div className="rounded-2xl bg-slate-100 animate-pulse lg:col-span-2" style={{ minHeight: '240px' }} />
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-3 h-4 w-56 rounded bg-slate-200 animate-pulse" />
        <div className="flex gap-4">
          <ChartSkeleton className="h-65.5" />
          <ChartSkeleton className="h-65.5" />
          <ChartSkeleton className="h-65.5 flex-1" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartSkeleton className="h-77.5" />
        <ChartSkeleton className="h-77.5" />
      </div>
    </>
  );
}