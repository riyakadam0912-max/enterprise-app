import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';

import { toast } from '@/providers/toast-provider';
import { extractApiErrorMessage } from '@/lib/api-errors';
import {
  clearAuthSession,
  setAuthSession,
  setActiveOrganization,
  getActiveOrganizationId,
  getActiveBusinessUnitId,
  getAuthSessionSnapshot,
  type AuthUser,
} from '@/stores/auth-store';

import { clientEnv } from '@/config/env';

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

interface AuthRefreshPayload {
  user: AuthUser;
  role: string;
  roles: string[];
  permissions: string[];
  employeeId: number | null;
  organizationId: number | null;
  organizationSlug?: string | null;
  organizationName?: string | null;
  organizationLogo?: string | null;
  isSuperAdmin?: boolean;
  isPlatformAdmin?: boolean;
}

let isRefreshing = false;

let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function clearAuthState() {
  clearAuthSession();
}

function processQueue(error: Error | null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(undefined);
    }
  });

  failedQueue = [];
}

export const axiosClient = axios.create({
  baseURL: API_URL,

  withCredentials: true,

  headers: {
    'Content-Type': 'application/json',
  },
});



/* REQUEST INTERCEPTOR */

axiosClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      try {
        const session = getAuthSessionSnapshot();
        const isPrivilegedTenantContext =
          session.isSuperAdmin || session.isPlatformAdmin;
        const requestUrl = config.url ?? '';
        const isAuthRequest = requestUrl.includes('/auth/');

        config.headers = config.headers ?? {};

        // Add X-Organization-Id for privileged users when explicitly selected
        if (isPrivilegedTenantContext && !isAuthRequest) {
          const activeOrgId = getActiveOrganizationId();
          if (activeOrgId != null) {
            config.headers['X-Organization-Id'] = String(activeOrgId);
          } else {
            delete config.headers['X-Organization-Id'];
          }
        } else {
          delete config.headers['X-Organization-Id'];
        }

        // Add X-Business-Unit-Id when a specific BU is selected
        // Only sent for non-auth endpoints
        if (!isAuthRequest) {
          const activeBUId = getActiveBusinessUnitId();
          if (activeBUId != null) {
            config.headers['X-Business-Unit-Id'] = String(activeBUId);
          } else {
            // If user can select all BUs and no specific one is selected, send ALL
            if (session.canSelectAllBusinessUnits) {
              config.headers['X-Business-Unit-Id'] = 'ALL';
            } else {
              delete config.headers['X-Business-Unit-Id'];
            }
          }
        } else {
          delete config.headers['X-Business-Unit-Id'];
        }
      } catch {
        // Non-critical: proceed without headers
      }
    }

    return config;
  },

  (error) => Promise.reject(error),
);



/* RESPONSE INTERCEPTOR */

axiosClient.interceptors.response.use(

  (response) => {
    return response;
  },

  async (error: AxiosError) => {

    const originalRequest =
      error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
        _skipAuthRefresh?: boolean;
      };

    const status = error.response?.status;

    const message = extractApiErrorMessage(
      error,
      'Request failed'
    );


    /* AUTH ENDPOINTS */

    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh');



    /* REFRESH TOKEN FLOW */

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest._skipAuthRefresh &&
      !isAuthEndpoint
    ) {

      if (isRefreshing) {

        return new Promise((resolve, reject) => {

          failedQueue.push({
            resolve,
            reject,
          });

        }).then(() => {

          return axiosClient(originalRequest);

        });

      }



      originalRequest._retry = true;

      isRefreshing = true;



      try {

        const response =
          await axiosClient.post<{
            success: boolean;
            message: string;
            data: AuthRefreshPayload;
          }>('/auth/refresh', { _skipAuthRefresh: true } as never);

        const payload = response.data?.data;

        const previouslySelectedOrgId = getActiveOrganizationId();

        if (payload) {

          setAuthSession({
            user: payload.user,

            role: payload.role,

            roles: payload.roles,

            permissions: payload.permissions,

            employeeId: payload.employeeId,

            organizationId: payload.organizationId,
            organizationSlug: payload.organizationSlug ?? null,
            organizationName: payload.organizationName ?? null,
            organizationLogo: payload.organizationLogo ?? null,
            isSuperAdmin: payload.isSuperAdmin,
            isPlatformAdmin: payload.isPlatformAdmin,
          });

          if (
            previouslySelectedOrgId != null &&
            (payload.organizationId == null ||
              Number(payload.organizationId) !== previouslySelectedOrgId)
          ) {
            setActiveOrganization(previouslySelectedOrgId);
          }
        }

        processQueue(null);

        return axiosClient(originalRequest);

      }

      catch (refreshError) {

        processQueue(refreshError as Error);

        clearAuthState();

        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.assign('/login');
        }

        return Promise.reject(refreshError);

      }

      finally {

        isRefreshing = false;

      }
    }



    /* OTHER ERRORS */

    if (
      typeof window !== 'undefined' &&
      status &&
      status !== 401
    ) {

      toast.error(
        'Request failed',
        message
      );

    }



    return Promise.reject(error);
  },
);
