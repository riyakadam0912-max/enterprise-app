export default function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="h-11 w-11 rounded-lg bg-slate-200" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-4 w-20 rounded bg-slate-200" />
          <div className="h-7 w-28 rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}