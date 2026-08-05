import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorResponse } from '../interfaces/api-response.interface';

function extractMessage(exception: unknown): string {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (typeof response === 'object' && response !== null) {
      const payload = response as Record<string, unknown>;
      const message = payload.message;

      if (Array.isArray(message)) {
        return message.map((item) => String(item)).join(', ');
      }

      if (typeof message === 'string') {
        return message;
      }

      return exception.message || 'Request failed';
    }

    return exception.message || 'Request failed';
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return 'Internal server error';
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    const message = extractMessage(exception);
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ApiErrorResponse = {
      success: false,
      message,
      data: null,
    };

    response.status(statusCode).json(body);
  }
}
