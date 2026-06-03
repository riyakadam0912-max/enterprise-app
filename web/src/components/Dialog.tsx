'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-80 flex items-center justify-center p-4">
      <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl')}>
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
        </div>
        <div className="px-6 py-5">{children}</div>
        <div className="border-t border-slate-200 px-6 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{cancelLabel}</Button>
            {onConfirm ? <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>{confirmLabel}</Button> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
