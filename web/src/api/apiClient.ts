import { AxiosError, type AxiosRequestConfig } from 'axios';
import { axiosClient } from './axiosClient';
import type { ApiResponseEnvelope } from '@/types/api';
import { toast } from '@/providers/toast-provider';
import { extractApiErrorMessage } from '@/lib/api-errors';

export class ApiError extends Error {
  status?: number;

  response?: unknown;

  constructor(message: string, status?: number, response?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }
}

function getErrorMessage(status: number | undefined, responseData: unknown, fallbackMessage: string): string {
  const serverMessage = typeof responseData === 'object' && responseData && 'message' in responseData
    ? String((responseData as { message?: unknown }).message ?? '')
    : '';

  switch (status) {
    case 400:
      return serverMessage || 'Invalid request. Please check your input and try again.';
    case 401:
      return serverMessage || 'Your session has expired. Please sign in again.';
    case 403:
      return serverMessage || 'You do not have permission to perform this action.';
    case 404:
      return serverMessage || 'The requested resource was not found.';
    case 409:
      return serverMessage || 'This action conflicts with existing data.';
    case 422:
      return serverMessage || 'Validation failed. Please check your input.';
    case 429:
      return serverMessage || 'Too many requests. Please try again later.';
    case 500:
      return serverMessage || 'Server error. Please try again later.';
    case 502:
      return serverMessage || 'Bad gateway. The server is temporarily unavailable.';
    case 503:
      return serverMessage || 'Service temporarily unavailable. Please try again later.';
    case 504:
      return serverMessage || 'Gateway timeout. The request took too long.';
    default:
      return serverMessage || fallbackMessage || 'Request failed. Please try again.';
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const config: AxiosRequestConfig = {
    url: endpoint,
    method: (options.method ?? 'GET') as AxiosRequestConfig['method'],
    headers: {
      ...(options.headers as Record<string, string> | undefined),
    },
  };

  if (options.body !== undefined) {
    if (typeof options.body === 'string') {
      try {
        config.data = JSON.parse(options.body);
      } catch {
        config.data = options.body;
      }
    } else {
      config.data = options.body;
    }
  }

  try {
    const response = await axiosClient.request<ApiResponseEnvelope<T>>(config);
    const payload = response.data;

    if (!payload || typeof payload !== 'object' || !('success' in payload)) {
      throw new Error('Invalid API response format');
    }

    if (!payload.success) {
      throw new Error(payload.message || 'API request failed');
    }

    return payload.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ message?: string }>;
    if (!axiosError.response) {
      const message = 'Backend not reachable. Start the NestJS API on port 3000.';
      toast.error('Backend unavailable', message);
      throw new Error(message);
    }

    const apiError = new ApiError(
      extractApiErrorMessage(axiosError, getErrorMessage(axiosError.response.status, axiosError.response.data, axiosError.message)),
      axiosError.response.status,
      axiosError.response,
    );

    if (typeof window !== 'undefined') {
      toast.error('Request failed', apiError.message);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[apiClient] request failed', {
        endpoint,
        status: axiosError.response.status,
      });
    }

    throw apiError;
  }
}

export function importData(
  endpoint: string,
  records: Record<string, unknown>[],
): Promise<{ imported: number; errors: string[] }> {
  return apiClient<{ imported: number; errors: string[] }>(endpoint, {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
}
