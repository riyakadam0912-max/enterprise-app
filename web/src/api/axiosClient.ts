import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from '@/providers/toast-provider';
import { extractApiErrorMessage } from '@/lib/api-errors';
import { clearAuthSession, setAuthSession, type AuthUser } from '@/stores/auth-store';
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

// Track refresh token state to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function clearAuthState() {
  clearAuthSession();
}

function processQueue(error: Error | null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(undefined);
    }
  });

  failedQueue = [];
}

export const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

axiosClient.interceptors.response.use(
  (response) => {
    console.log('[axiosClient] Response success:', {
      url: response.config?.url,
      method: response.config?.method,
      status: response.status,
      statusText: response.statusText,
      data: response.data,
    });
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const message = extractApiErrorMessage(error, 'Request failed');

    const logData: Record<string, unknown> = {
      url: error.config?.url,
      method: error.config?.method,
      requestHeaders: error.config?.headers,
      axiosErrorCode: error.code,
      axiosErrorMessage: error.message,
      stack: error.stack,
    };

    if (error.response) {
      logData.responseStatus = error.response.status;
      logData.responseStatusText = error.response.statusText;
      logData.responseHeaders = error.response.headers;
      logData.responseBody = error.response.data;

      if (error.response.status === 403) {
        logData.authHeadersPresent = !!error.config?.headers?.Authorization;
      }

      console.error('[axiosClient] Response error:', logData);
    } else {
      console.error('[axiosClient] Network/CORS error:', logData);
    }

    // Check if the request is to an auth endpoint that shouldn't trigger refresh/redirect
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') || 
                           originalRequest?.url?.includes('/auth/register') || 
                           originalRequest?.url?.includes('/auth/refresh');

    // Handle 401 errors with token refresh logic
    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return axiosClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post<AuthRefreshResponse>(`${API_URL}/auth/refresh`, undefined, {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const apiResponse = response.data;
        const refreshData = apiResponse.success ? apiResponse.data : undefined;

        if (refreshData) {
          setAuthSession({
            role: refreshData.role,
            user: refreshData.user,
            employeeId: refreshData.employeeId,
          });
        }

        processQueue(null);

        // Retry the original request after refresh
        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error);

        if (typeof window !== 'undefined') {
          clearAuthState();
          if (window.location.pathname !== '/login') {
            toast.error('Session expired', 'Please sign in again.');
            window.location.assign('/login');
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other errors
    if (typeof window !== 'undefined') {
      if (status === 401 && !isAuthEndpoint) {
        // 401 without retry capability - clear auth and redirect only for non-auth endpoints
        clearAuthState();
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
      } else if (status && !isAuthEndpoint) {
        toast.error('Request failed', message);
      }
    }

    return Promise.reject(error);
  },
);
