import axios, { type AxiosRequestConfig } from 'axios';
import { axiosClient } from './axiosClient';
import type { ApiResponseEnvelope } from '@/types/api';
import { extractApiErrorMessage, normalizeMessage } from '@/lib/api-errors';

export class ApiError extends Error {
  status?: number;
  response?: unknown;
  code?: string;
  requestId?: string;

  constructor(
    message: string,
    status?: number,
    response?: unknown,
    code?: string,
    requestId?: string,
  ) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.response = response;
    this.code = code;
    this.requestId = requestId;
  }
}

function getErrorMessage(
  status: number | undefined,
  responseData: unknown,
  fallbackMessage: string,
): string {
  // Extract message from response data if possible
  let serverMessage = '';
  if (
    typeof responseData === 'object' &&
    responseData &&
    'message' in responseData
  ) {
    serverMessage = normalizeMessage(
      (responseData as { message?: string | string[] | null | undefined }).message,
      '',
    );
  }

  switch (status) {
    case 400:
      return serverMessage || 'Invalid request. Please check your input.';

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
      return serverMessage || 'Bad gateway.';

    case 503:
      return serverMessage || 'Service temporarily unavailable.';

    case 504:
      return serverMessage || 'Gateway timeout.';

    default:
      return serverMessage || fallbackMessage || 'Request failed.';
  }
}

function unwrapEnvelope<T>(payload: unknown): T {
  let current = payload;
  while (
    current &&
    typeof current === 'object' &&
    'success' in current &&
    typeof (current as Record<string, unknown>).success === 'boolean' &&
    'data' in current
  ) {
    const rec = current as Record<string, unknown>;
    if (rec.success === false) {
      throw new ApiError(
        typeof rec.message === 'string' ? rec.message : 'API request failed',
        undefined,
        rec,
        typeof rec.code === 'string' ? rec.code : undefined,
        typeof rec.requestId === 'string' ? rec.requestId : undefined,
      );
    }
    current = rec.data;
  }
  return current as T;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const config: AxiosRequestConfig = {
    url: endpoint,
    method:
      (options.method ?? 'GET') as AxiosRequestConfig['method'],
    headers: {
      ...(options.headers as
        | Record<string, string>
        | undefined),
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
    const response =
      await axiosClient.request<ApiResponseEnvelope<T>>(
        config,
      );

    const payload = response.data;

    if (
      !payload ||
      typeof payload !== 'object' ||
      !('success' in payload)
    ) {
      throw new ApiError(
        'Invalid API response format',
      );
    }

    if (!payload.success) {
      throw new ApiError(
        payload.message || 'API request failed',
      );
    }

    return unwrapEnvelope<T>(payload);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (!error.response) {
        throw new ApiError(
          'Backend not reachable. Verify NestJS server is running.',
          503,
          error,
        );
      }

      throw new ApiError(
        extractApiErrorMessage(
          error,
          getErrorMessage(
            status,
            error.response.data,
            error.message,
          ),
        ),
        status,
        error.response,
        typeof error.response.data === 'object' && error.response.data
          ? (error.response.data as { code?: string }).code
          : undefined,
        error.response.headers?.['x-request-id'] ??
          (typeof error.response.data === 'object' && error.response.data
            ? (error.response.data as { requestId?: string }).requestId
            : undefined),
      );
    }

    throw error;
  }
}



export function importData(
  endpoint: string,
  records: Record<string, unknown>[],
): Promise<{
  imported: number;
  errors: string[];
}> {

  return apiClient(endpoint, {

    method: 'POST',

    body: JSON.stringify({
      records,
    }),

  });
}