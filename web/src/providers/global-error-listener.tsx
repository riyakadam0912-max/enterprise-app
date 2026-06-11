'use client';

import { useEffect } from 'react';
import { toast } from '@/providers/toast-provider';
import { getErrorMessage } from '@/lib/error-handling';

export default function GlobalErrorListener({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event?.reason) {
        const message = getErrorMessage(event.reason, 'Unhandled promise rejection');
        console.error('Unhandled promise rejection', event.reason);
        toast.error('Unhandled promise rejection', message);
      }
    };

    const handleError = (event: ErrorEvent) => {
      const message = getErrorMessage(event.error ?? event.message, 'Unhandled exception');
      console.error('Unhandled exception', event.error ?? event.message, event.error ?? event);
      toast.error('Unhandled exception', message);
    };

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return <>{children}</>;
}
