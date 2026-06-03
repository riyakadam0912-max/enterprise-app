'use client';

import { ThemeProvider } from '@/theme/theme-provider';
import { ToastProvider } from './toast-provider';
import { ModalProvider } from './modal-provider';

export function DesignSystemProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ModalProvider>{children}</ModalProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
