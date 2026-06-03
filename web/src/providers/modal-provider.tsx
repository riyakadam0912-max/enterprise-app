'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import type { ModalRequest } from '@/types/design-system';

export type ModalState = ModalRequest & { id: string };

type ModalApi = {
  openModal: (request: ModalRequest) => string;
  closeModal: () => void;
};

const ModalContext = createContext<ModalApi | null>(null);
let globalModalApi: ModalApi | null = null;

function sizeClasses(size: ModalRequest['size']) {
  switch (size) {
    case 'sm':
      return 'max-w-md';
    case 'lg':
      return 'max-w-4xl';
    case 'xl':
      return 'max-w-6xl';
    case 'fullscreen':
      return 'h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none';
    default:
      return 'max-w-2xl';
  }
}

function PanelShell({ request, onClose, onConfirm }: { request: ModalState; onClose: () => void; onConfirm: () => void }) {
  const fullscreen = request.type === 'fullscreen' || request.size === 'fullscreen';
  const panelClasses = cn(
    'relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl',
    sizeClasses(request.size),
    fullscreen && 'h-[calc(100vh-2rem)]'
  );

  if (request.type === 'drawer' || request.type === 'sheet') {
    return (
      <div className="fixed inset-y-0 right-0 z-80 w-full max-w-xl bg-white shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{request.type}</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">{request.title}</h2>
            {request.description ? <p className="mt-2 text-sm text-slate-600">{request.description}</p> : null}
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{request.content}</div>
          <div className="border-t border-slate-200 px-6 py-4">
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                {request.cancelLabel ?? 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={panelClasses}>
      <div className="border-b border-slate-200 px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{request.type}</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">{request.title}</h2>
        {request.description ? <p className="mt-2 text-sm text-slate-600">{request.description}</p> : null}
      </div>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-5">{request.content}</div>
      <div className="border-t border-slate-200 px-6 py-4">
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            {request.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-semibold text-white',
              request.destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'
            )}
          >
            {request.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  const openModal = useCallback((request: ModalRequest) => {
    const id = crypto.randomUUID();
    setModal({ id, ...request });
    return id;
  }, []);

  const api = useMemo<ModalApi>(() => ({ openModal, closeModal }), [closeModal, openModal]);

  useEffect(() => {
    globalModalApi = api;
    return () => {
      if (globalModalApi === api) {
        globalModalApi = null;
      }
    };
  }, [api]);

  useEffect(() => {
    if (!modal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeModal, modal]);

  return (
    <ModalContext.Provider value={api}>
      {children}
      {mounted && modal && createPortal(
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={closeModal}
          />
          <PanelShell request={modal} onClose={closeModal} onConfirm={async () => {
            await modal.onConfirm?.();
            closeModal();
          }} />
        </div>, document.body
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }

  return context;
}

export const openModal = (request: ModalRequest) => globalModalApi?.openModal(request);
export const closeModal = () => globalModalApi?.closeModal();
