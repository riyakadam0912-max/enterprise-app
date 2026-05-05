export default function AnalyticsKpiSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="mt-4 h-3 w-28 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-8 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-slate-100" />
    </div>
  );
}