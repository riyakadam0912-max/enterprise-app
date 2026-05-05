export default function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="h-3 w-20 rounded bg-slate-200" />
      </div>
      <div className="h-72 rounded-xl bg-slate-100" />
    </div>
  );
}