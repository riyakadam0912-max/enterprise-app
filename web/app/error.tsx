'use client';

import { useEffect } from 'react';
import { FriendlyErrorState } from '@/components/common/FriendlyErrorState';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Route rendering error', error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <FriendlyErrorState error={error} fallback="We couldn’t load this page. Please try again." onRetry={reset} />
    </main>
  );
}
