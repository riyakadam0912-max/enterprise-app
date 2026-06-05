import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from '@/providers/toast-provider';
import { extractApiErrorMessage } from '@/lib/api-errors';
import { clearAuthSession } from '@/stores/auth-store';
import { clientEnv } from '@/config/env';

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

// Track refresh token state to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function clearAuthState() {
  clearAuthSession();
}

function processQueue(error: Error | null, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
}

export const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token') ?? localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
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
        // Attempt to refresh the token
        // Note: This requires a /auth/refresh endpoint on the backend
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: newRefreshToken } = response.data;

        // Update tokens in localStorage
        localStorage.setItem('token', access_token);
        localStorage.setItem('access_token', access_token);
        if (newRefreshToken) {
          localStorage.setItem('refresh_token', newRefreshToken);
        }

        // Update the authorization header
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        // Process queued requests
        processQueue(null, access_token);

        // Retry the original request
        return axiosClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect to login
        processQueue(refreshError as Error, null);
        
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
