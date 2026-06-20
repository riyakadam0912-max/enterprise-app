import type { AxiosError } from 'axios';

export function normalizeMessage(
  message: string | string[] | undefined | null,
  fallback: string,
): string {
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  if (typeof message === 'string' && message.trim() !== '') {
    return message;
  }
  return fallback;
}

export function extractApiErrorMessage(error: unknown, fallbackMessage = 'Request failed'): string {
  if (!error) return fallbackMessage;

  if (error instanceof Error && error.name === 'ApiError') {
    return error.message || fallbackMessage;
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const errMsg = (error as { message?: unknown }).message;
    if (typeof errMsg === 'string') {
      return errMsg;
    }
  }

  const axiosError = error as AxiosError<{
    success?: boolean;
    message?: string | string[];
    error?: string;
    statusCode?: number;
  }>;
  const response = axiosError.response?.data;

  if (!response) {
    return fallbackMessage;
  }

  // Normalize and use the message first
  const normalizedMsg = normalizeMessage(response.message, '');
  if (normalizedMsg) {
    return normalizedMsg;
  }

  // Handle statusCode + error
  if (response.statusCode && response.error) {
    return `${response.error} (${response.statusCode})`;
  }

  if (axiosError.response?.status === 401) {
    return normalizeMessage(response.message, 'Your session has expired. Please sign in again.');
  }

  if (axiosError.response?.status === 403) {
    return normalizeMessage(response.message, 'You do not have permission to access this resource.');
  }

  return fallbackMessage;
}

export function isUnauthorizedError(error: unknown): boolean {
  const axiosError = error as AxiosError;
  return axiosError.response?.status === 401;
}
