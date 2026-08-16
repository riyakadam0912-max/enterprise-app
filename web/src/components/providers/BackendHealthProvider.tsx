'use client';

import { useEffect, useRef, useState } from 'react';
import { clientEnv } from '@/config/env';

type BackendHealthState = 'checking' | 'up' | 'down';

export default function BackendHealthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BackendHealthState>('checking');
  const skipStrictEffectRun = useRef(process.env.NODE_ENV === 'development');

  useEffect(() => {
    if (skipStrictEffectRun.current) {
      skipStrictEffectRun.current = false;
      return;
    }

    let active = true;
    let controller: AbortController | null = null;

    const checkHealth = async (signal: AbortSignal) => {
      try {
        const response = await fetch(`${clientEnv.NEXT_PUBLIC_API_URL}/health`, {
          cache: 'no-store',
          signal,
        });
        if (!active) {
          return;
        }

        setState(response.ok ? 'up' : 'down');
      } catch (err) {
        if (!active) {
          return;
        }

        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }

        setState('down');
      }
    };

    controller = new AbortController();
    void checkHealth(controller.signal);

    const intervalId = window.setInterval(() => {
      if (controller && !controller.signal.aborted) {
        controller.abort('refresh');
      }
      controller = new AbortController();
      void checkHealth(controller.signal);
    }, 30000);

    return () => {
      active = false;
      controller?.abort('unmount');
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
