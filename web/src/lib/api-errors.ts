import type { AxiosError } from 'axios';

export function extractApiErrorMessage(error: unknown, fallbackMessage = 'Request failed'): string {
  if (!error) return fallbackMessage;

  if (error instanceof Error && error.name === 'ApiError') {
    return error.message || fallbackMessage;
  }

  if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }

  const axiosError = error as AxiosError<{ message?: string }>; 
  const responseMessage = axiosError.response?.data?.message;

  if (axiosError.response?.status === 401) {
    return responseMessage || 'Your session has expired. Please sign in again.';
  }

  if (axiosError.response?.status === 403) {
    return responseMessage || 'You do not have permission to access this resource.';
  }

  return responseMessage || fallbackMessage;
}

export function isUnauthorizedError(error: unknown): boolean {
  const axiosError = error as AxiosError;
  return axiosError.response?.status === 401;
}
