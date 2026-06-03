'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ToastRequest, ToastVariant } from '@/types/design-system';
import { cn } from '@/lib/cn';

export type ToastItem = ToastRequest & {
  id: string;
  variant: ToastVariant;
};

type ToastApi = {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  push: (toast: ToastRequest) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);
let globalToastApi: ToastApi | null = null;

function variantStyles(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-950';
    case 'error':
      return 'border-rose-200 bg-rose-50 text-rose-950';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-950';
    default:
      return 'border-sky-200 bg-sky-50 text-sky-950';
  }
}

function badgeColor(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return 'bg-emerald-500';
    case 'error':
      return 'bg-rose-500';
    case 'warning':
      return 'bg-amber-500';
    default:
      return 'bg-sky-500';
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const timersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current[id];
    if (timer) {
      window.clearTimeout(timer);
      delete timersRef.current[id];
    }
  }, []);

  const push = useCallback((toast: ToastRequest) => {
    const id = crypto.randomUUID();
    const nextToast: ToastItem = {
      id,
      variant: toast.variant ?? 'info',
      duration: toast.duration ?? 4000,
      title: toast.title,
      description: toast.description,
      actionLabel: toast.actionLabel,
      onAction: toast.onAction,
    };

    setToasts((current) => [nextToast, ...current].slice(0, 4));
    timersRef.current[id] = window.setTimeout(() => dismiss(id), nextToast.duration);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (title, description) => push({ title, description, variant: 'success' }),
    error: (title, description) => push({ title, description, variant: 'error' }),
    warning: (title, description) => push({ title, description, variant: 'warning' }),
    info: (title, description) => push({ title, description, variant: 'info' }),
    push,
    dismiss,
    clear: () => setToasts([]),
  }), [dismiss, push]);

  useEffect(() => {
    globalToastApi = api;
    return () => {
      if (globalToastApi === api) {
        globalToastApi = null;
      }
    };
  }, [api]);

  useEffect(() => () => {
    Object.values(timersRef.current).forEach((timer) => window.clearTimeout(timer));
    timersRef.current = {};
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed right-4 top-4 z-70 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className={cn('overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur', variantStyles(toast.variant))}
            >
              <div className="flex items-start gap-3">
                <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', badgeColor(toast.variant))} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  {toast.description ? <p className="mt-1 text-sm opacity-80">{toast.description}</p> : null}
                  {toast.actionLabel && toast.onAction ? (
                    <button
                      type="button"
                      onClick={toast.onAction}
                      className="mt-3 rounded-lg border border-current/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
                    >
                      {toast.actionLabel}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide opacity-70 transition hover:opacity-100"
                  aria-label="Dismiss toast"
                >
                  Close
                </button>
              </div>
            </div>
          ))}
        </div>, document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}

export const toast = {
  success(title: string, description?: string) {
    globalToastApi?.success(title, description);
  },
  error(title: string, description?: string) {
    globalToastApi?.error(title, description);
  },
  warning(title: string, description?: string) {
    globalToastApi?.warning(title, description);
  },
  info(title: string, description?: string) {
    globalToastApi?.info(title, description);
  },
  push(request: ToastRequest) {
    globalToastApi?.push(request);
  },
  clear() {
    globalToastApi?.clear();
  },
};
