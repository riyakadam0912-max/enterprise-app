'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { getUserFacingError } from '@/lib/api-errors';

type FriendlyErrorStateProps = { error?: unknown; fallback?: string; onRetry?: () => void; compact?: boolean };

export function FriendlyErrorState({ error, fallback, onRetry, compact = false }: FriendlyErrorStateProps) {
  const presentation = getUserFacingError(error, fallback ?? 'Please try again in a moment.');
  return (
    <div className={`rounded-2xl border border-amber-200 bg-amber-50 text-amber-950 ${compact ? 'p-3' : 'p-5'}`} role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{presentation.title}</p><p className="mt-1 text-sm text-amber-900/80">{presentation.message}</p>
          {onRetry ? <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again</button> : null}
        </div>
      </div>
    </div>
  );
}
