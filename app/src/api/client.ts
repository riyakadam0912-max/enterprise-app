import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { env } from '@/src/config/env';

const ACCESS_KEY = 'erp_mobile_access_token';
const REFRESH_KEY = 'erp_mobile_refresh_token';
const ORG_KEY = 'erp_mobile_organization_id';
const BU_KEY = 'erp_mobile_business_unit_id';

const isWeb = Platform.OS === 'web';

function getStoredValue(key: string) {
  return isWeb ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null) : SecureStore.getItemAsync(key);
}

function setStoredValue(key: string, value: string) {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return Promise.resolve();
  }
  return SecureStore.setItemAsync(key, value);
}

function deleteStoredValue(key: string) {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return Promise.resolve();
  }
  return SecureStore.deleteItemAsync(key);
}

export const tokenStore = {
  getAccess: () => getStoredValue(ACCESS_KEY),
  getRefresh: () => getStoredValue(REFRESH_KEY),
  save: async (access: string, refresh: string) => { await setStoredValue(ACCESS_KEY, access); await setStoredValue(REFRESH_KEY, refresh); },
  clear: async () => { await deleteStoredValue(ACCESS_KEY); await deleteStoredValue(REFRESH_KEY); },
};

export const contextStore = {
  getOrg: () => getStoredValue(ORG_KEY),
  setOrg: (id: number | null) => id == null ? deleteStoredValue(ORG_KEY) : setStoredValue(ORG_KEY, String(id)),
  getBU: () => getStoredValue(BU_KEY),
  setBU: (id: number | null) => id == null ? deleteStoredValue(BU_KEY) : setStoredValue(BU_KEY, String(id)),
};

export const api = axios.create({ baseURL: env.apiUrl, timeout: 20000, headers: { 'Content-Type': 'application/json' } });
let refreshing: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null) { onSessionExpired = handler; }

api.interceptors.request.use(async (config) => {
  const access = await tokenStore.getAccess();
  const org = await contextStore.getOrg();
  const bu = await contextStore.getBU();
  config.headers = config.headers ?? {};
  if (access) config.headers.Authorization = `Bearer ${access}`;
  if (org) config.headers['X-Organization-Id'] = org;
  if (bu) config.headers['X-Business-Unit-Id'] = bu;
  return config;
});

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await tokenStore.getRefresh();
  if (!refresh) return null;
  const response = await axios.post(`${env.apiUrl}/auth/refresh`, {}, { headers: { Authorization: `Bearer ${refresh}` }, timeout: 20000 });
  const payload = unwrap<{ access_token?: string; refresh_token?: string }>(response.data);
  if (!payload.access_token || !payload.refresh_token) return null;
  await tokenStore.save(payload.access_token, payload.refresh_token);
  return payload.access_token;
}

api.interceptors.response.use((response) => response, async (error: AxiosError) => {
  const request = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
  if (error.response?.status === 401 && request && !request._retry && !request.url?.includes('/auth/')) {
    request._retry = true;
    refreshing ??= refreshAccessToken().finally(() => { refreshing = null; });
    const access = await refreshing;
    if (access) { request.headers.Authorization = `Bearer ${access}`; return api(request); }
    await tokenStore.clear();
    onSessionExpired?.();
  }
  throw error;
});

export function unwrap<T>(payload: unknown): T {
  let current = payload as any;
  while (current && typeof current === 'object' && typeof current.success === 'boolean' && 'data' in current) {
    if (!current.success) throw new Error(current.message ?? 'API request failed');
    current = current.data;
  }
  return current as T;
}

export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const serverMessage = (error.response?.data as any)?.message;
    if (serverMessage) return Array.isArray(serverMessage) ? serverMessage.join(', ') : String(serverMessage);
    if (status === 401) return 'Your session has expired. Please sign in again.';
    if (status === 403) return 'You do not have permission for this action.';
    if (status === 404) return 'The requested mobile service or record was not found.';
    if (status && status >= 500) return 'The server could not complete this request. Please try again.';
    if (!error.response) {
      const reason = error.code ? ` (${error.code})` : '';
      return `Cannot reach the ERP service${reason}. Endpoint: ${env.apiUrl}`;
    }
    return `The request failed (${status}). Please try again.`;
  }
  return error instanceof Error ? error.message : 'The request failed.';
}
