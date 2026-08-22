'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Route rendering error', error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="text-sm text-slate-600">We couldn&apos;t load this page. Please try again.</p>
      <button type="button" onClick={() => reset()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Try again</button>
    </main>
  );
}