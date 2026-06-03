import axios, { type AxiosError } from 'axios';
import { toast } from '@/providers/toast-provider';
import { extractApiErrorMessage } from '@/lib/api-errors';
import { clearAuthSession } from '@/stores/auth-store';
import { clientEnv } from '@/config/env';

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

function clearAuthState() {
  clearAuthSession();
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
  (error: AxiosError) => {
    const status = error.response?.status;
    const message = extractApiErrorMessage(error, 'Request failed');

    if (typeof window !== 'undefined') {
      if (status === 401) {
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
