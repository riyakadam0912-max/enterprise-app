import { AxiosError, type AxiosRequestConfig } from 'axios';
import { axiosClient } from './axiosClient';
import type { ApiResponseEnvelope } from '@/types/api';

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
      throw new Error('Backend not reachable. Start the NestJS API on port 3000.');
    }

    throw new Error(
      axiosError.response?.data?.message ??
      axiosError.message ??
      'API request failed',
    );
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
