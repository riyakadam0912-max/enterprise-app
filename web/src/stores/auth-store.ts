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

export type BusinessUnit = {
  id: number;
  name: string;
  code: string;
  parentId: number | null;
  status: string;
};

export type AuthSession = {
  role: AuthRole;
  roles: string[];
  permissions: string[];
  user: AuthUser | null;
  employeeId: number | null;
  organizationId: number | null;
  organizationSlug: string | null;
  organizationName: string | null;
  organizationLogo: string | null;
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
  availableBusinessUnits: BusinessUnit[];
  activeBusinessUnitId: number | null;
  canSelectAllBusinessUnits: boolean;
};

type AuthSessionInput = {
  role?: string | null;
  roles?: string[];
  permissions?: string[];
  user?: AuthUser | null;
  employeeId?: number | string | null;
  organizationId?: number | string | null;
  organizationSlug?: string | null;
  organizationName?: string | null;
  organizationLogo?: string | null;
  isSuperAdmin?: boolean;
  isPlatformAdmin?: boolean;
  availableBusinessUnits?: BusinessUnit[];
  activeBusinessUnitId?: number | null;
  canSelectAllBusinessUnits?: boolean;
};

const AUTH_STATE_EVENT = 'enterprise-auth-state-change';
const STORAGE_KEY = 'enterprise-auth-session';
const ACTIVE_BUSINESS_UNIT_KEY = 'enterprise-active-business-unit';

const SERVER_AUTH_SESSION: AuthSession = Object.freeze({
  role: 'EMPLOYEE',
  roles: [],
  permissions: [],
  user: null,
  employeeId: null,
  organizationId: null,
  organizationSlug: null,
  organizationName: null,
  organizationLogo: null,
  isSuperAdmin: false,
  isPlatformAdmin: false,
  availableBusinessUnits: [],
  activeBusinessUnitId: null,
  canSelectAllBusinessUnits: false,
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

function parseBusinessUnitId(rawBusinessUnitId: string | null): number | null {
  if (!rawBusinessUnitId) {
    return null;
  }

  const parsed = Number(rawBusinessUnitId);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBusinessUnits(rawUnits: unknown): BusinessUnit[] {
  if (!Array.isArray(rawUnits)) {
    return [];
  }

  return rawUnits
    .filter(
      (unit): unit is BusinessUnit => {
        if (typeof unit !== 'object' || unit === null) {
          return false;
        }

        const candidate = unit as Record<string, unknown>;
        return (
          typeof candidate.id === 'number' &&
          typeof candidate.name === 'string' &&
          typeof candidate.code === 'string'
        );
      },
    );
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
      organizationName: parsed.organizationName ?? null,
      organizationLogo: parsed.organizationLogo ?? null,
      availableBusinessUnits: parseBusinessUnits(parsed.availableBusinessUnits),
      activeBusinessUnitId: parseBusinessUnitId(parsed.activeBusinessUnitId == null ? null : String(parsed.activeBusinessUnitId)),
      canSelectAllBusinessUnits: parsed.canSelectAllBusinessUnits === true,
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
    organizationName: session.organizationName ?? null,
    organizationLogo: session.organizationLogo ?? null,
    isSuperAdmin: resolved.isSuperAdmin,
    isPlatformAdmin: resolved.isPlatformAdmin,
    availableBusinessUnits: parseBusinessUnits(session.availableBusinessUnits),
    activeBusinessUnitId: parseBusinessUnitId(session.activeBusinessUnitId == null ? null : String(session.activeBusinessUnitId)),
    canSelectAllBusinessUnits: session.canSelectAllBusinessUnits === true,
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
    window.sessionStorage.removeItem(ACTIVE_BUSINESS_UNIT_KEY);
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
    // Clear stale name/logo immediately; caller should follow up with
    // setActiveOrganizationDetails() once the org data has been fetched.
    organizationName: null,
    organizationLogo: null,
    organizationSlug: null,
  };

  saveSessionToStorage(cachedSession);
  notifyAuthStateChange();
}

/**
 * Persist the display metadata for the currently-impersonated organisation so
 * the Topbar can show the name and logo without an extra render-phase fetch.
 *
 * Call this immediately after the org details API response arrives.
 */
export function setActiveOrganizationDetails(details: {
  name: string;
  logoUrl?: string | null;
  slug?: string | null;
}): void {
  if (typeof window === 'undefined') {
    return;
  }

  const session = getAuthSessionSnapshot();
  if (!(session.isSuperAdmin || session.isPlatformAdmin)) {
    return;
  }

  cachedSession = {
    ...cachedSession,
    organizationName: details.name,
    organizationLogo: details.logoUrl ?? null,
    organizationSlug: details.slug ?? null,
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
    organizationName: null,
    organizationLogo: null,
    organizationSlug: null,
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

/**
 * Set active business unit in session storage.
 * Only allowed if user can select multiple business units or is changing to their assigned unit.
 * Backend remains authoritative.
 */
export function setActiveBusinessUnit(businessUnitId: number | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const session = getAuthSessionSnapshot();

  // Only allow if user can select multiple BUs
  if (!session.canSelectAllBusinessUnits) {
    // User can only stay with their assigned unit
    if (businessUnitId != null && businessUnitId !== session.activeBusinessUnitId) {
      console.warn(
        `[auth-store] User cannot select Business Unit ${businessUnitId}: not authorized for multiple BU selection`,
      );
      return;
    }
  }

  // Validate that the requested BU is in the available list
  if (businessUnitId != null) {
    const isAvailable = session.availableBusinessUnits.some((bu) => bu.id === businessUnitId);
    if (!isAvailable) {
      console.warn(
        `[auth-store] Business Unit ${businessUnitId} is not in the available list`,
      );
      return;
    }
  }

  try {
    if (businessUnitId == null) {
      window.sessionStorage.removeItem(ACTIVE_BUSINESS_UNIT_KEY);
    } else {
      window.sessionStorage.setItem(
        ACTIVE_BUSINESS_UNIT_KEY,
        JSON.stringify({ id: businessUnitId }),
      );
    }
  } catch (e) {
    console.warn('[auth-store] Failed to persist active business unit:', e);
  }

  cachedSession = {
    ...cachedSession,
    activeBusinessUnitId: businessUnitId,
  };

  saveSessionToStorage(cachedSession);
  notifyAuthStateChange();
}

/**
 * Get active business unit ID from session storage.
 * Returns null if no BU is selected or user is viewing all BUs.
 */
export function getActiveBusinessUnitId(): number | null {
  const session = getAuthSessionSnapshot();

  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(ACTIVE_BUSINESS_UNIT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: number };
        if (typeof parsed?.id === 'number' && Number.isFinite(parsed.id)) {
          return parsed.id;
        }
      }
    } catch (e) {
      console.warn('[auth-store] Failed to read active business unit:', e);
    }
  }

  return session.activeBusinessUnitId;
}

/**
 * Clear active business unit, typically when switching organizations or logging out.
 */
export function clearActiveBusinessUnit(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(ACTIVE_BUSINESS_UNIT_KEY);
  } catch (e) {
    console.warn('[auth-store] Failed to clear active business unit:', e);
  }

  cachedSession = {
    ...cachedSession,
    activeBusinessUnitId: null,
  };

  saveSessionToStorage(cachedSession);
  notifyAuthStateChange();
}

/**
 * Reset business unit context when organization or user changes.
 * Clears stored BU and reloads from session data.
 */
export function resetBusinessUnitContext(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(ACTIVE_BUSINESS_UNIT_KEY);
  } catch (e) {
    console.warn('[auth-store] Failed to clear business unit context:', e);
  }

  // Don't change cachedSession here, just clear storage
  notifyAuthStateChange();
}


// Initialize cached session from storage
if (typeof window !== 'undefined') {
  cachedSession = loadSessionFromStorage();
}
