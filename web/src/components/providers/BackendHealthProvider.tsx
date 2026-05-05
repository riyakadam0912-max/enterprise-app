'use client';

import { useEffect, useState } from 'react';

type BackendHealthState = 'checking' | 'up' | 'down';

export default function BackendHealthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BackendHealthState>('checking');

  useEffect(() => {
    let active = true;

    const checkHealth = async () => {
      try {
        const response = await fetch('/api/v1/health', { cache: 'no-store' });
        if (!active) {
          return;
        }

        setState(response.ok ? 'up' : 'down');
      } catch {
        if (active) {
          setState('down');
        }
      }
    };

    void checkHealth();

    const intervalId = window.setInterval(() => {
      void checkHealth();
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      {state === 'down' ? (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm">
          Backend not reachable. Start the NestJS API on port 3000.
        </div>
      ) : null}
      {children}
    </>
  );
}