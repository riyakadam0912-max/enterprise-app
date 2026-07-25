'use client';

import { useEffect, useState } from 'react';
import { clientEnv } from '@/config/env';

type BackendHealthState = 'checking' | 'up' | 'down';

export default function BackendHealthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BackendHealthState>('checking');

  useEffect(() => {
    let active = true;
    const controllers: AbortController[] = [];

    const checkHealth = async () => {
      const controller = new AbortController();
      controllers.push(controller);
      try {
        const response = await fetch(`${clientEnv.NEXT_PUBLIC_API_URL}/health`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!active) {
          return;
        }

        setState(response.ok ? 'up' : 'down');
      } catch (err) {
        if (active && !(err instanceof DOMException && err.name === 'AbortError')) {
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
      controllers.forEach((c) => {
        try {
          c.abort();
        } catch {
        }
      });
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