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
      } catch {
        // Non-critical: proceed without organization header
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
          }>(
            '/auth/refresh'
          );

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
