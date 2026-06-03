import { clearAuthSession } from '@/stores/auth-store';

export function logout(): void {
  if (typeof window !== 'undefined') {
    clearAuthSession();
    window.location.href = '/login';
  }
}
