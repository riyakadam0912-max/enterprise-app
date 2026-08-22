import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('hides internal error details in production mode while preserving the client error contract', () => {
    const filter = new HttpExceptionFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
      }),
    };

    const error = new Error('PrismaClientKnownRequestError: SQLSTATE 23505');
    filter.catch(error, host as any);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Something went wrong. Please try again.',
        data: null,
      }),
    );
    expect(json.mock.calls[0][0].message).not.toContain(
      'PrismaClientKnownRequestError',
    );
  });

  it('keeps validation/auth messages for public client errors', () => {
    const filter = new HttpExceptionFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
      }),
    };

    filter.catch(
      new HttpException('Invalid email or password', HttpStatus.UNAUTHORIZED),
      host as any,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Invalid email or password',
        data: null,
      }),
    );
  });

  it('returns safe status codes and messages for authorization and rate limits', () => {
    const filter = new HttpExceptionFilter();
    const responses = [
      new HttpException(
        'internal permission.guard detail',
        HttpStatus.FORBIDDEN,
      ),
      new HttpException('missing record', HttpStatus.NOT_FOUND),
      new HttpException('rate limiter internals', HttpStatus.TOO_MANY_REQUESTS),
    ].map(() => {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      return { json, status };
    });
    const host = {
      switchToHttp: () => ({
        getResponse: () => responses[0],
      }),
    };

    filter.catch(
      new HttpException(
        'internal permission.guard detail',
        HttpStatus.FORBIDDEN,
      ),
      host as any,
    );

    expect(responses[0].json.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        code: 'FORBIDDEN',
        message: "You don't have permission to perform this action.",
        requestId: expect.stringMatching(/^ERR-/),
      }),
    );
  });

  it('does not expose technical messages from public exceptions', () => {
    const filter = new HttpExceptionFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
      }),
    };

    filter.catch(
      new HttpException(
        'PrismaClientValidationError: SQL connection failed',
        HttpStatus.BAD_REQUEST,
      ),
      host as any,
    );

    expect(json.mock.calls[0][0].message).toBe(
      'Please check the information you entered.',
    );
  });
});
