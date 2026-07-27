import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { ApiSuccessResponse } from '../interfaces/api-response.interface';

function normalizePayload(payload: unknown): {
  message: string;
  data: unknown;
} {
  if (!payload || typeof payload !== 'object') {
    return { message: 'Request successful', data: payload };
  }

  const record = payload as Record<string, unknown>;

  const hasSuccess =
    Object.prototype.hasOwnProperty.call(record, 'success') &&
    typeof record.success === 'boolean';
  const hasMessage =
    Object.prototype.hasOwnProperty.call(record, 'message') &&
    typeof record.message === 'string';
  const hasData = Object.prototype.hasOwnProperty.call(record, 'data');

  if (hasSuccess && hasMessage && hasData) {
    return {
      message: record.message as string,
      data: record.data,
    };
  }

  if (hasSuccess && hasData) {
    return {
      message: hasMessage ? (record.message as string) : 'Request successful',
      data: record.data,
    };
  }

  if (hasSuccess && hasMessage) {
    const { message, ...rest } = record;
    const remaining: Record<string, unknown> = { ...rest };
    if (hasMessage) {
      remaining.message = message;
    }
    return {
      message: message as string,
      data: Object.keys(remaining).length > 0 ? remaining : undefined,
    };
  }

  if (hasMessage) {
    return {
      message: record.message as string,
      data: payload,
    };
  }

  return { message: 'Request successful', data: payload };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<unknown>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<unknown>> {
    return next.handle().pipe(
      map((payload) => {
        const normalized = normalizePayload(payload);
        return {
          success: true as const,
          message: normalized.message,
          data: normalized.data,
        };
      }),
    );
  }
}
