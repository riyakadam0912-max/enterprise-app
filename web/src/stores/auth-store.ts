'use client';

import { useSyncExternalStore } from 'react';

export type AuthRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

export type AuthUser = {
  id?: number | null;
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
  token?: string | null;
  role?: string | null;
  user?: AuthUser | null;
  employeeId?: number | string | null;
};

const AUTH_STATE_EVENT = 'enterprise-auth-state-change';

const SERVER_AUTH_SESSION: AuthSession = Object.freeze({
  role: 'ADMIN',
  user: null,
  employeeId: null,
});

let cachedRoleRaw: string | null | undefined;
let cachedUserRaw: string | null | undefined;
let cachedEmployeeIdRaw: string | null | undefined;
let cachedSession: AuthSession = SERVER_AUTH_SESSION;

function normalizeRole(role?: string | null): AuthRole {
  if (role === 'EMPLOYEE' || role === 'MANAGER' || role === 'HR') {
    return role;
  }

  return 'ADMIN';
}

function parseEmployeeId(rawEmployeeId: string | null): number | null {
  if (!rawEmployeeId) {
    return null;
  }

  const parsed = Number(rawEmployeeId);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStoredUser(rawUser: string | null): AuthUser | null {
  if (!rawUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawUser) as Partial<AuthUser> | null;
    if (!parsed || (!parsed.name && !parsed.email)) {
      return null;
    }

    return {
      id: typeof parsed.id === 'number' ? parsed.id : null,
      name: parsed.name ?? 'User',
      email: parsed.email ?? '',
      role: parsed.role,
      jobTitle: parsed.jobTitle,
      designation: parsed.designation,
      position: parsed.position,
      department: parsed.department,
      team: parsed.team,
    };
  } catch {
    return null;
  }
}

function readRawValue(key: string): string | null {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
}

function buildSessionSnapshot(roleRaw: string | null, userRaw: string | null, employeeIdRaw: string | null): AuthSession {
  return {
    role: normalizeRole(roleRaw),
    user: parseStoredUser(userRaw),
    employeeId: parseEmployeeId(employeeIdRaw),
  };
}

function readSessionSnapshot(): AuthSession {
  if (typeof window === 'undefined') {
    return SERVER_AUTH_SESSION;
  }

  const roleRaw = readRawValue('role');
  const userRaw = readRawValue('currentUser');
  const employeeIdRaw = readRawValue('employeeId');

  if (
    roleRaw === cachedRoleRaw &&
    userRaw === cachedUserRaw &&
    employeeIdRaw === cachedEmployeeIdRaw
  ) {
    return cachedSession;
  }

  cachedRoleRaw = roleRaw;
  cachedUserRaw = userRaw;
  cachedEmployeeIdRaw = employeeIdRaw;
  cachedSession = buildSessionSnapshot(roleRaw, userRaw, employeeIdRaw);

  return cachedSession;
}

export function notifyAuthStateChange(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_STATE_EVENT));
}

export function subscribeAuthState(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStoreChange = () => onStoreChange();
  window.addEventListener('storage', handleStoreChange);
  window.addEventListener(AUTH_STATE_EVENT, handleStoreChange);

  return () => {
    window.removeEventListener('storage', handleStoreChange);
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

  if (typeof session.token === 'string') {
    window.localStorage.setItem('token', session.token);
    window.localStorage.setItem('access_token', session.token);
  }

  if (session.role) {
    window.localStorage.setItem('role', normalizeRole(session.role));
  }

  if (session.user) {
    window.localStorage.setItem('currentUser', JSON.stringify(session.user));
  } else {
    window.localStorage.removeItem('currentUser');
  }

  if (session.employeeId === null || session.employeeId === undefined || session.employeeId === '') {
    window.localStorage.removeItem('employeeId');
  } else {
    window.localStorage.setItem('employeeId', String(session.employeeId));
  }

  notifyAuthStateChange();
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem('token');
  window.localStorage.removeItem('access_token');
  window.localStorage.removeItem('role');
  window.localStorage.removeItem('employeeId');
  window.localStorage.removeItem('currentUser');
  notifyAuthStateChange();
}