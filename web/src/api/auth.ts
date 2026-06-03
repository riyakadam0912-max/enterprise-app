/**
 * Authentication utility module
 * Handles token retrieval and storage
 */

import { notifyAuthStateChange } from '@/stores/auth-store';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem('access_token');
}

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', token);
    notifyAuthStateChange();
  }
}

export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    notifyAuthStateChange();
  }
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}
