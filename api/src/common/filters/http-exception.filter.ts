import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorResponse } from '../interfaces/api-response.interface';

function extractMessage(exception: unknown, isProduction: boolean): string {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    const statusCode = exception.getStatus();

    if (isProduction && statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'Internal server error';
    }

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
    return isProduction ? 'Internal server error' : exception.message;
  }

  return 'Internal server error';
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const isProduction = process.env.NODE_ENV === 'production';

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = extractMessage(exception, isProduction);

    const body: ApiErrorResponse = {
      success: false,
      message,
      data: null,
    };

    response.status(statusCode).json(body);
  }
}
