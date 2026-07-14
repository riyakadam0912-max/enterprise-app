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
  roles: string[];
  permissions: string[];
  user: AuthUser | null;
  employeeId: number | null;
  organizationId: number | null;
};

type AuthSessionInput = {
  role?: string | null;
  roles?: string[];
  permissions?: string[];
  user?: AuthUser | null;
  employeeId?: number | string | null;
  organizationId?: number | string | null;
};

const AUTH_STATE_EVENT = 'enterprise-auth-state-change';
const STORAGE_KEY = 'enterprise-auth-session';

const SERVER_AUTH_SESSION: AuthSession = Object.freeze({
  role: 'EMPLOYEE',
  roles: [],
  permissions: [],
  user: null,
  employeeId: null,
  organizationId: null,
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

function parseOrganizationId(rawOrganizationId: string | null): number | null {
  if (!rawOrganizationId) {
    return null;
  }

  const parsed = Number(rawOrganizationId);
  return Number.isFinite(parsed) ? parsed : null;
}

function notifyAuthStateChange(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_STATE_EVENT));
}

function loadSessionFromStorage(): AuthSession {
  if (typeof window === 'undefined') {
    return SERVER_AUTH_SESSION;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return SERVER_AUTH_SESSION;
    }

    const parsed = JSON.parse(raw) as AuthSession;
    return {
      ...SERVER_AUTH_SESSION,
      ...parsed,
      role: normalizeRole(parsed.role),
      employeeId: parseEmployeeId(parsed.employeeId == null ? null : String(parsed.employeeId)),
      organizationId: parseOrganizationId(parsed.organizationId == null ? null : String(parsed.organizationId)),
    };
  } catch (e) {
    console.warn('[auth-store] Failed to load session from storage:', e);
    return SERVER_AUTH_SESSION;
  }
}

function saveSessionToStorage(session: AuthSession): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('[auth-store] Failed to save session to storage:', e);
  }
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
    roles: session.roles ?? [],
    permissions: session.permissions ?? [],
    user: session.user ?? null,
    employeeId: parseEmployeeId(session.employeeId == null ? null : String(session.employeeId)),
    organizationId: parseOrganizationId(session.organizationId == null ? null : String(session.organizationId)),
  };

  saveSessionToStorage(cachedSession);
  notifyAuthStateChange();
  console.log('[auth-store] Set auth session:', cachedSession);
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[auth-store] Failed to clear session from storage:', e);
  }

  cachedSession = SERVER_AUTH_SESSION;
  notifyAuthStateChange();
  console.log('[auth-store] Cleared auth session');
}

// Initialize cached session from storage
if (typeof window !== 'undefined') {
  cachedSession = loadSessionFromStorage();
}
