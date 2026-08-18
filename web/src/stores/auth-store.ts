'use client';

import { useSyncExternalStore } from 'react';

export type AuthRole = 'SUPER_ADMIN' | 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

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
  organizationSlug: string | null;
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
};

type AuthSessionInput = {
  role?: string | null;
  roles?: string[];
  permissions?: string[];
  user?: AuthUser | null;
  employeeId?: number | string | null;
  organizationId?: number | string | null;
  organizationSlug?: string | null;
  isSuperAdmin?: boolean;
  isPlatformAdmin?: boolean;
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
  organizationSlug: null,
  isSuperAdmin: false,
  isPlatformAdmin: false,
});

let cachedSession: AuthSession = SERVER_AUTH_SESSION;

function normalizeRole(role?: string | null): AuthRole {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR' || role === 'MANAGER' || role === 'EMPLOYEE') {
    return role;
  }

  return 'EMPLOYEE';
}

function normalizeRoleList(roles?: string[] | null): string[] {
  if (!Array.isArray(roles)) {
    return [];
  }

  return roles
    .map((role) => (typeof role === 'string' ? role.trim().toUpperCase() : ''))
    .filter(Boolean);
}

function resolveAccessFlags(input: {
  role?: string | null;
  roles?: string[] | null;
  isSuperAdmin?: boolean;
  isPlatformAdmin?: boolean;
}): {
  role: AuthRole;
  roles: string[];
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
} {
  const normalizedRoles = normalizeRoleList(input.roles);
  const normalizedRole = normalizeRole(input.role);

  const primaryRole =
    normalizedRole !== 'EMPLOYEE'
      ? normalizedRole
      : (['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] as AuthRole[]).find((candidate) =>
          normalizedRoles.includes(candidate),
        ) ?? 'EMPLOYEE';

  const hasSuperAdminRole = normalizedRoles.includes('SUPER_ADMIN') || primaryRole === 'SUPER_ADMIN';
  const hasPlatformAdminRole =
    normalizedRoles.includes('SUPER_ADMIN') ||
    normalizedRoles.includes('ADMIN') ||
    primaryRole === 'SUPER_ADMIN' ||
    primaryRole === 'ADMIN';

  return {
    role: primaryRole,
    roles: normalizedRoles,
    isSuperAdmin: input.isSuperAdmin === true || hasSuperAdminRole,
    isPlatformAdmin: input.isPlatformAdmin === true || hasSuperAdminRole || hasPlatformAdminRole,
  };
}

export function isSuperAdminSession(session?: Partial<AuthSession>): boolean {
  const normalizedRole = normalizeRole(session?.role);
  const normalizedRoles = normalizeRoleList(session?.roles);

  return session?.isSuperAdmin === true || normalizedRole === 'SUPER_ADMIN' || normalizedRoles.includes('SUPER_ADMIN');
}

export function isPlatformAdminSession(session?: Partial<AuthSession>): boolean {
  const normalizedRole = normalizeRole(session?.role);
  const normalizedRoles = normalizeRoleList(session?.roles);

  return session?.isPlatformAdmin === true || normalizedRole === 'SUPER_ADMIN' || normalizedRole === 'ADMIN' || normalizedRoles.includes('SUPER_ADMIN') || normalizedRoles.includes('ADMIN');
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
    const resolved = resolveAccessFlags({
      role: parsed.role,
      roles: parsed.roles,
      isSuperAdmin: parsed.isSuperAdmin,
      isPlatformAdmin: parsed.isPlatformAdmin,
    });

    return {
      ...SERVER_AUTH_SESSION,
      ...parsed,
      ...resolved,
      employeeId: parseEmployeeId(parsed.employeeId == null ? null : String(parsed.employeeId)),
      organizationId: parseOrganizationId(parsed.organizationId == null ? null : String(parsed.organizationId)),
      organizationSlug: parsed.organizationSlug ?? null,
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

function initializeSession() {
  if (cachedSession === SERVER_AUTH_SESSION && typeof window !== 'undefined') {
    cachedSession = loadSessionFromStorage();
  }
}

function readSessionSnapshot(): AuthSession {
  initializeSession();
  return cachedSession;
}

export function getAuthSessionSnapshot(): AuthSession {
  initializeSession();
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

export function setAuthSession(session: AuthSessionInput): void {
  if (typeof window === 'undefined') {
    return;
  }

  const resolved = resolveAccessFlags(session);

  cachedSession = {
    role: resolved.role,
    roles: resolved.roles,
    permissions: session.permissions ?? [],
    user: session.user ?? null,
    employeeId: parseEmployeeId(session.employeeId == null ? null : String(session.employeeId)),
    organizationId: parseOrganizationId(session.organizationId == null ? null : String(session.organizationId)),
    organizationSlug: session.organizationSlug ?? null,
    isSuperAdmin: resolved.isSuperAdmin,
    isPlatformAdmin: resolved.isPlatformAdmin,
  };

  saveSessionToStorage(cachedSession);
  notifyAuthStateChange();
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem('activeOrganization');
  } catch (e) {
    console.warn('[auth-store] Failed to clear session from storage:', e);
  }

  cachedSession = SERVER_AUTH_SESSION;
  notifyAuthStateChange();
}

export function setActiveOrganization(organizationId: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  const session = getAuthSessionSnapshot();
  const isPrivilegedTenantContext =
    session.isSuperAdmin || session.isPlatformAdmin;

  if (!isPrivilegedTenantContext) {
    try {
      window.sessionStorage.removeItem('activeOrganization');
    } catch (e) {
      console.warn('[auth-store] Failed to clear stale active organization:', e);
    }
    return;
  }

  try {
    window.sessionStorage.setItem(
      'activeOrganization',
      JSON.stringify({ id: organizationId }),
    );
  } catch (e) {
    console.warn('[auth-store] Failed to persist active organization:', e);
  }

  cachedSession = {
    ...cachedSession,
    organizationId: Number.isFinite(organizationId) ? organizationId : null,
  };

  saveSessionToStorage(cachedSession);
  notifyAuthStateChange();
}

export function clearActiveOrganization(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem('activeOrganization');
  } catch (e) {
    console.warn('[auth-store] Failed to clear active organization:', e);
  }

  cachedSession = {
    ...cachedSession,
    organizationId: null,
  };

  saveSessionToStorage(cachedSession);
  notifyAuthStateChange();
}

export function getActiveOrganizationId(): number | null {
  const session = getAuthSessionSnapshot();
  const isPrivilegedTenantContext =
    session.isSuperAdmin || session.isPlatformAdmin;

  if (!isPrivilegedTenantContext) {
    return null;
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem('activeOrganization');
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: number };
        if (typeof parsed?.id === 'number' && Number.isFinite(parsed.id)) {
          return parsed.id;
        }
      }
    } catch (e) {
      console.warn('[auth-store] Failed to read active organization:', e);
    }
  }
  return cachedSession.organizationId;
}

// Initialize cached session from storage
if (typeof window !== 'undefined') {
  cachedSession = loadSessionFromStorage();
}
