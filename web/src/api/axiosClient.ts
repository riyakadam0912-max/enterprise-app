import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from '@/providers/toast-provider';
import { extractApiErrorMessage } from '@/lib/api-errors';
import { clearAuthSession, setAuthSession, type AuthUser } from '@/stores/auth-store';
import { clientEnv } from '@/config/env';

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

interface AuthRefreshPayload {
  user: AuthUser;
  role: string;
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
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const message = extractApiErrorMessage(error, 'Request failed');

    // Handle 401 errors with token refresh logic
    if (status === 401 && originalRequest && !originalRequest._retry) {
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
      if (status === 401) {
        // 401 without retry capability - clear auth and redirect
        clearAuthState();
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
      } else if (status) {
        toast.error('Request failed', message);
      }

      if (process.env.NODE_ENV !== 'production' && status === 403) {
        console.debug('[axiosClient] Forbidden response', {
          url: error.config?.url,
          method: error.config?.method,
        });
      }
    }

    return Promise.reject(error);
  },
);
