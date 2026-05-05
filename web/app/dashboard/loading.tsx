import CardSkeleton from '@/components/dashboard/CardSkeleton';
import DashboardChartsSkeleton from '@/components/dashboard/DashboardChartsSkeleton';

export default function DashboardLoading() {
  return (
    <div className="bg-slate-50 min-h-full p-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="h-4 w-48 rounded bg-slate-200 animate-pulse" />
            <div className="mt-2 h-3 w-80 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="h-10 w-36 rounded-lg bg-slate-200 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>

      <DashboardChartsSkeleton />
    </div>
  );
}