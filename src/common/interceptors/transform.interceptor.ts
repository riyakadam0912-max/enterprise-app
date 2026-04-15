import { CallHandler, ExecutionContext, Injectable, NestInterceptor, HttpStatus } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { ApiSuccessResponse } from '../interfaces/api-response.interface';

function unwrapPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, 'success') && Object.prototype.hasOwnProperty.call(record, 'data')) {
    return record.data;
  }

  return payload;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<unknown>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<unknown>> {
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();

    return next.handle().pipe(
      map((payload) => ({
        success: true as const,
        statusCode: response?.statusCode ?? HttpStatus.OK,
        data: unwrapPayload(payload),
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
