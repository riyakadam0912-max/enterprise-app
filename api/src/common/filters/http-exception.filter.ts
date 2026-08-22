import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import type { ApiErrorResponse } from '../interfaces/api-response.interface';

function createRequestId(request: {
  headers?: Record<string, unknown>;
}): string {
  const incoming = request.headers?.['x-request-id'];
  if (
    typeof incoming === 'string' &&
    /^[A-Za-z0-9._:-]{1,80}$/.test(incoming)
  ) {
    return incoming;
  }
  return `ERR-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function extractFields(response: unknown): Record<string, string> | undefined {
  if (!response || typeof response !== 'object') return undefined;
  const message = (response as Record<string, unknown>).message;
  if (!Array.isArray(message)) return undefined;
  const fields: Record<string, string> = {};
  for (const item of message) {
    if (typeof item !== 'string') continue;
    const match = item.match(/^([A-Za-z][\w.]*) must be/);
    if (match) fields[match[1]] = item;
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

function isSafeClientMessage(message: string): boolean {
  return !/(Prisma|SQL|database|postgres|JWT|token|stack|environment variable|\/var\/task|ECONN|ETIMEDOUT)/i.test(
    message,
  );
}

function safeMessage(message: string, fallback: string): string {
  return isSafeClientMessage(message) ? message : fallback;
}

function extractMessage(exception: unknown, statusCode: number): string {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') return 'This record already exists.';
    if (exception.code === 'P2025')
      return 'The requested record could not be found.';
    if (exception.code === 'P2003')
      return 'This action cannot be completed because the related record does not exist.';
  }
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return statusCode === HttpStatus.BAD_GATEWAY ||
        statusCode === HttpStatus.SERVICE_UNAVAILABLE ||
        statusCode === HttpStatus.GATEWAY_TIMEOUT
        ? 'The service is temporarily unavailable. Please try again shortly.'
        : 'Something went wrong. Please try again.';
    }
    if (statusCode === HttpStatus.UNAUTHORIZED) {
      if (
        typeof response === 'string' &&
        /invalid email or password/i.test(response)
      ) {
        return response;
      }
      return 'Your session has expired. Please sign in again.';
    }
    if (statusCode === HttpStatus.FORBIDDEN)
      return "You don't have permission to perform this action.";
    if (statusCode === HttpStatus.NOT_FOUND)
      return 'The requested record could not be found.';
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS)
      return 'Too many attempts. Please wait a moment and try again.';

    if (typeof response === 'string') {
      return safeMessage(response, 'Please check the information you entered.');
    }

    if (typeof response === 'object' && response !== null) {
      const payload = response as Record<string, unknown>;
      const message = payload.message;

      if (Array.isArray(message)) {
        return safeMessage(
          message.map((item) => String(item)).join(', '),
          'Please check the information you entered.',
        );
      }

      if (typeof message === 'string') {
        return safeMessage(
          message,
          'Please check the information you entered.',
        );
      }

      return safeMessage(
        exception.message,
        'Please check the information you entered.',
      );
    }

    return safeMessage(
      exception.message,
      'Please check the information you entered.',
    );
  }

  if (exception instanceof Error) {
    return statusCode >= HttpStatus.BAD_GATEWAY
      ? 'The service is temporarily unavailable. Please try again shortly.'
      : 'Something went wrong. Please try again.';
  }

  return 'Something went wrong. Please try again.';
}

function classifyError(exception: unknown, statusCode: number): string {
  if (statusCode === 400 || statusCode === 422) return 'VALIDATION_ERROR';
  if (statusCode === 401) return 'SESSION_EXPIRED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  if (statusCode === 429) return 'RATE_LIMITED';
  if (statusCode === 502 || statusCode === 503 || statusCode === 504)
    return 'SERVICE_UNAVAILABLE';
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') return 'CONFLICT';
    if (exception.code === 'P2025') return 'NOT_FOUND';
    if (exception.code === 'P2003') return 'RELATED_RECORD_NOT_FOUND';
  }
  return 'INTERNAL_ERROR';
}

function getStatusCode(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') return HttpStatus.CONFLICT;
    if (exception.code === 'P2025') return HttpStatus.NOT_FOUND;
    if (exception.code === 'P2003') return HttpStatus.BAD_REQUEST;
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request =
      typeof context.getRequest === 'function'
        ? context.getRequest<{
            method?: string;
            originalUrl?: string;
            headers?: Record<string, unknown>;
            user?: { id?: number; organizationId?: number | null };
          }>()
        : {};

    const statusCode = getStatusCode(exception);
    const requestId = createRequestId(request);
    const message = extractMessage(exception, statusCode);
    const code = classifyError(exception, statusCode);
    const isUnexpected = statusCode >= HttpStatus.INTERNAL_SERVER_ERROR;

    if (isUnexpected) {
      console.error('[API ERROR]', {
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode,
        userId: request.user?.id,
        organizationId: request.user?.organizationId,
        error: exception,
      });
    }

    const body: ApiErrorResponse = {
      success: false,
      message,
      code,
      requestId,
      fields:
        exception instanceof HttpException
          ? extractFields(exception.getResponse())
          : undefined,
      data: null,
    };

    response.setHeader?.('X-Request-Id', requestId);
    response.status(statusCode).json(body);
  }
}
