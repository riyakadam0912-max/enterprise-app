import axios, { type AxiosRequestConfig } from 'axios';
import { axiosClient } from './axiosClient';
import type { ApiResponseEnvelope } from '@/types/api';
import { extractApiErrorMessage, normalizeMessage } from '@/lib/api-errors';

export class ApiError extends Error {
  status?: number;
  response?: unknown;

  constructor(
    message: string,
    status?: number,
    response?: unknown,
  ) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }
}

function getErrorMessage(
  status: number | undefined,
  responseData: unknown,
  fallbackMessage: string,
): string {
  // Extract message from response data if possible
  let serverMessage = '';
  if (
    typeof responseData === 'object' &&
    responseData &&
    'message' in responseData
  ) {
    serverMessage = normalizeMessage(
      (responseData as { message?: string | string[] | null | undefined }).message,
      '',
    );
  }

  switch (status) {
    case 400:
      return serverMessage || 'Invalid request. Please check your input.';

    case 401:
      return serverMessage || 'Your session has expired. Please sign in again.';

    case 403:
      return serverMessage || 'You do not have permission to perform this action.';

    case 404:
      return serverMessage || 'The requested resource was not found.';

    case 409:
      return serverMessage || 'This action conflicts with existing data.';

    case 422:
      return serverMessage || 'Validation failed. Please check your input.';

    case 429:
      return serverMessage || 'Too many requests. Please try again later.';

    case 500:
      return serverMessage || 'Server error. Please try again later.';

    case 502:
      return serverMessage || 'Bad gateway.';

    case 503:
      return serverMessage || 'Service temporarily unavailable.';

    case 504:
      return serverMessage || 'Gateway timeout.';

    default:
      return serverMessage || fallbackMessage || 'Request failed.';
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {

  const config: AxiosRequestConfig = {

    url: endpoint,

    method:
      (options.method ?? 'GET') as AxiosRequestConfig['method'],

    headers: {
      ...(options.headers as
        | Record<string, string>
        | undefined),
    },
  };



  if (options.body !== undefined) {

    if (typeof options.body === 'string') {

      try {

        config.data = JSON.parse(options.body);

      } catch {

        config.data = options.body;

      }

    } else {

      config.data = options.body;

    }
  }



  console.log('[apiClient] Request', {

    endpoint,

    method: config.method,

    headers: config.headers,

    data: config.data,

  });



  try {

    const response =
      await axiosClient.request<ApiResponseEnvelope<T>>(
        config,
      );



    console.log('[apiClient] Success', {

      endpoint,

      status: response.status,

      data: response.data,

    });



    const payload = response.data;



    if (
      !payload ||
      typeof payload !== 'object' ||
      !('success' in payload)
    ) {

      throw new ApiError(
        'Invalid API response format',
      );

    }



    if (!payload.success) {

      throw new ApiError(
        payload.message || 'API request failed',
      );

    }



    return payload.data;

  } catch (error: unknown) {

    if (axios.isAxiosError(error)) {

      const status = error.response?.status;



      console.group('[apiClient] Error');

      console.table({

        endpoint,

        status,

        method: error.config?.method,

        url: error.config?.url,

        code: error.code,

        message: error.message,

      });

      console.log(
        'Response:',
        error.response?.data,
      );

      console.groupEnd();



      if (!error.response) {

        throw new ApiError(

          'Backend not reachable. Verify NestJS server is running.',

          503,

          error,
        );

      }



      throw new ApiError(

        extractApiErrorMessage(
          error,

          getErrorMessage(

            status,

            error.response.data,

            error.message,
          ),
        ),

        status,

        error.response,
      );

    }



    console.error(
      '[apiClient] Non Axios Error',
      error,
    );



    throw error;
  }
}



export function importData(
  endpoint: string,
  records: Record<string, unknown>[],
): Promise<{
  imported: number;
  errors: string[];
}> {

  return apiClient(endpoint, {

    method: 'POST',

    body: JSON.stringify({
      records,
    }),

  });
}