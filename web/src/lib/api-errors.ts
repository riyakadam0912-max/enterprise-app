import axios, { type AxiosError } from 'axios';

export interface UserFacingError {
  title: string;
  message: string;
  action?: string;
  requestId?: string;
}

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

function getErrorDetails(error: unknown): { status?: number; code?: string; requestId?: string; rawMessage?: string } {
  if (error instanceof Error && error.name === 'ApiError') {
    const apiError = error as Error & { status?: number; code?: string; requestId?: string };
    return { status: apiError.status, code: apiError.code, requestId: apiError.requestId, rawMessage: apiError.message };
  }
  const axiosError = error as AxiosError<{ code?: string; requestId?: string; message?: string | string[] }>;
  return {
    status: axiosError.response?.status,
    code: axiosError.response?.data?.code,
    requestId: axiosError.response?.data?.requestId ?? axiosError.response?.headers?.['x-request-id'],
    rawMessage: normalizeMessage(axiosError.response?.data?.message, ''),
  };
}

function isTechnicalMessage(message: string): boolean {
  return /(?:Prisma|P\d{4}|SQL|stack trace|undefined|null reference|constraint|query engine|ECONN|ENOTFOUND|socket|endpoint|request failed)/i.test(message);
}

export function getUserFacingError(error: unknown, fallback = 'We couldn\'t complete that request.'): UserFacingError {
  const { status, code, requestId, rawMessage } = getErrorDetails(error);
  const safeMessage = rawMessage && !isTechnicalMessage(rawMessage) ? rawMessage : undefined;

  if (status === 401 || code === 'AUTH_REQUIRED') {
    return { title: 'Sign-in required', message: 'Your session has expired. Please sign in again.', action: 'Sign in' };
  }
  if (status === 403 || code?.includes('NOT_ALLOWED') || code?.includes('FORBIDDEN')) {
    return { title: 'You don’t have access', message: safeMessage ?? 'You don’t have permission to complete this action.' };
  }
  if (status === 404 || code?.includes('NOT_FOUND')) {
    return { title: 'We couldn’t find that', message: safeMessage ?? 'This item may have been removed or is no longer available.' };
  }
  if (status === 409 || code?.includes('CONFLICT')) {
    return { title: 'This needs your attention', message: safeMessage ?? 'The item changed while you were working. Refresh and try again.' };
  }
  if (status === 400 || status === 422) {
    return { title: 'Please check the details', message: safeMessage ?? 'Review the highlighted fields and try again.' };
  }
  if (status === 429) {
    return { title: 'Please wait a moment', message: 'Too many attempts were made. Try again shortly.' };
  }
  if (status && status >= 500) {
    return { title: 'We’re having trouble', message: 'Something went wrong on our side. Please try again.', action: 'Try again', requestId };
  }
  return { title: 'Unable to complete request', message: safeMessage ?? fallback, action: 'Try again', requestId };
}

export function isUnauthorizedError(error: unknown): boolean {
  const axiosError = error as AxiosError;
  return axiosError.response?.status === 401;
}
