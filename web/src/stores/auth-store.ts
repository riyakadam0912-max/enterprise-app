'use client';

import { useSyncExternalStore } from 'react';

export type AuthRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

export type AuthUser = {
  id: number | null;
  name: string;
  email: string;
  role?: string;
  jobTitle?: string;
  designation?: string;
  position?: string;
  department?: string;
  team?: string;
};

export type AuthSession = {
  role: AuthRole;
  user: AuthUser | null;
  employeeId: number | null;
};

type AuthSessionInput = {
  role?: string | null;
  user?: AuthUser | null;
  employeeId?: number | string | null;
};

const AUTH_STATE_EVENT = 'enterprise-auth-state-change';

const SERVER_AUTH_SESSION: AuthSession = Object.freeze({
  role: 'EMPLOYEE',
  user: null,
  employeeId: null,
});

let cachedSession: AuthSession = SERVER_AUTH_SESSION;

function normalizeRole(role?: string | null): AuthRole {
  if (role === 'EMPLOYEE' || role === 'MANAGER' || role === 'HR' || role === 'ADMIN') {
    return role;
  }

  return 'EMPLOYEE';
}

function parseEmployeeId(rawEmployeeId: string | null): number | null {
  if (!rawEmployeeId) {
    return null;
  }

  const parsed = Number(rawEmployeeId);
  return Number.isFinite(parsed) ? parsed : null;
}

function notifyAuthStateChange(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_STATE_EVENT));
}

function readSessionSnapshot(): AuthSession {
  return cachedSession;
}

export function subscribeAuthState(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStoreChange = () => onStoreChange();
  window.addEventListener(AUTH_STATE_EVENT, handleStoreChange);

  return () => {
    window.removeEventListener(AUTH_STATE_EVENT, handleStoreChange);
  };
}

export function useAuthSession(): AuthSession {
  return useSyncExternalStore(subscribeAuthState, readSessionSnapshot, () => SERVER_AUTH_SESSION);
}

export function getAuthSessionSnapshot(): AuthSession {
  return readSessionSnapshot();
}

export function setAuthSession(session: AuthSessionInput): void {
  if (typeof window === 'undefined') {
    return;
  }

  cachedSession = {
    role: normalizeRole(session.role),
    user: session.user ?? null,
    employeeId: parseEmployeeId(session.employeeId == null ? null : String(session.employeeId)),
  };

  notifyAuthStateChange();
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  cachedSession = SERVER_AUTH_SESSION;
  notifyAuthStateChange();
}
