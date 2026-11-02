'use client';

interface CustomerSelectFieldProps {
  selectedName: string;
  onClick: () => void;
}

export function CustomerSelectField({ selectedName, onClick }: CustomerSelectFieldProps) {
  return (
    <div className="space-y-1.5 text-sm font-medium text-slate-700">
      <span className="block">Customer</span>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-normal transition hover:border-orange-300 hover:bg-orange-50/40 focus:outline-none focus:ring-2 focus:ring-orange-100"
      >
        <span className={selectedName ? 'truncate text-slate-800' : 'text-slate-400'}>
          {selectedName || 'Choose a customer'}
        </span>
        <span className="shrink-0 text-xs font-medium text-orange-600">Browse</span>
      </button>
    </div>
  );
}
