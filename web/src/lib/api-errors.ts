import axios, { type AxiosError } from 'axios';

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
    const apiError = error as Error & { status?: number; requestId?: string };
    const message = apiError.message || fallbackMessage;
    if (apiError.status && apiError.status >= 500 && apiError.requestId) {
      return `${message} Reference: ${apiError.requestId}`;
    }
    return message;
  }

  const axiosError = error as AxiosError<{
    success?: boolean;
    message?: string | string[];
    error?: string;
    statusCode?: number;
    code?: string;
  }>;
  const response = axiosError.response?.data;

  if (!response) {
    if (axios.isAxiosError(error)) {
      const errMsg = error.message;
      if (errMsg && !/^Request failed with status code \d+$/.test(errMsg)) {
        return errMsg.includes('Network Error')
          ? 'The service is temporarily unavailable. Please try again shortly.'
          : fallbackMessage;
      }
    }
    return fallbackMessage;
  }

  // Normalize and use the message first
  const normalizedMsg = normalizeMessage(response.message, '');
  if (normalizedMsg) {
    const requestId = (response as { requestId?: string }).requestId;
    const status = axiosError.response?.status;
    return status && status >= 500 && requestId
      ? `${normalizedMsg} Reference: ${requestId}`
      : normalizedMsg;
  }

  // Handle statusCode + error
  const status = axiosError.response?.status;
  if (status === 400 || status === 422) return 'Please check the information you entered.';
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return "You don't have permission to perform this action.";
  if (status === 404) return 'The requested record could not be found.';
  if (status === 409) return 'This action could not be completed because the record already exists or has changed.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status && status >= 500) return status === 502 || status === 503 || status === 504
    ? 'The service is temporarily unavailable. Please try again shortly.'
    : 'Something went wrong. Please try again.';
  return fallbackMessage;
}

export function isUnauthorizedError(error: unknown): boolean {
  const axiosError = error as AxiosError;
  return axiosError.response?.status === 401;
}
