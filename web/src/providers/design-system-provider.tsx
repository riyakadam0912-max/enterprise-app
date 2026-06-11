'use client';

import { ThemeProvider } from '@/theme/theme-provider';
import { ToastProvider } from './toast-provider';
import { ModalProvider } from './modal-provider';
import GlobalErrorListener from './global-error-listener';

export function DesignSystemProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <GlobalErrorListener>
          <ModalProvider>{children}</ModalProvider>
        </GlobalErrorListener>
      </ToastProvider>
    </ThemeProvider>
  );
}
