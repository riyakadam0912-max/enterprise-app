export type ThemeMode = 'light' | 'dark' | 'system';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export type ModalType = 'confirm' | 'delete' | 'warning' | 'success' | 'fullscreen' | 'drawer' | 'sheet';

export type ModalRequest = {
  type: ModalType;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
  content?: React.ReactNode;
  onConfirm?: () => void | Promise<void>;
};

export type ToastRequest = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
};
