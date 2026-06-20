import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';

import { toast } from '@/providers/toast-provider';
import { extractApiErrorMessage } from '@/lib/api-errors';
import {
  clearAuthSession,
  setAuthSession,
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
}

interface AuthRefreshResponse {
  success?: boolean;
  message?: string;
  data?: AuthRefreshPayload;
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
    console.log('[Axios Request]', {
      url: config.url,
      baseURL: config.baseURL,
      method: config.method,
      withCredentials: config.withCredentials,
      headers: config.headers,
    });

    return config;
  },

  (error) => Promise.reject(error),
);



/* RESPONSE INTERCEPTOR */

axiosClient.interceptors.response.use(

  (response) => {
    console.log('[Axios Success]', {
      url: response.config.url,
      method: response.config.method,
      status: response.status,
      data: response.data,
    });

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



    /* ERROR LOGGING */

    console.group('===== AXIOS ERROR =====');

    console.error(error);

    console.table({
      message: error.message,

      code: error.code,

      status: error.response?.status,

      url: error.config?.url,

      baseURL: error.config?.baseURL,

      method: error.config?.method,

      withCredentials: error.config?.withCredentials,
    });

    console.log('Response Body:', error.response?.data);

    console.groupEnd();



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

        if (payload) {

          setAuthSession({
            user: payload.user,

            role: payload.role,

            roles: payload.roles,

            permissions: payload.permissions,

            employeeId: payload.employeeId,
          });

        }

        processQueue(null);

        return axiosClient(originalRequest);

      }

      catch (refreshError) {

        processQueue(refreshError as Error);

        clearAuthState();

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