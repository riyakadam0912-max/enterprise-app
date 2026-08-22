'use client';

import { toast } from '@/providers/toast-provider';
import { extractApiErrorMessage } from '@/lib/api-errors';

export function getErrorMessage(error: unknown, fallback = 'Something went wrong') {
  return extractApiErrorMessage(error, fallback);
}

export function reportError(error: unknown, title = 'Request failed') {
  const message = getErrorMessage(error);
  console.error(title, error);
  toast.error(title, message);
}

export async function retryAsync<T>(fn: () => Promise<T>, attempts = 2, delayMs = 200): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError;
}
