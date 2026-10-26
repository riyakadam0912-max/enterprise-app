import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { AuditContextMiddleware } from './audit-context.middleware';
import { getAuditContext } from './audit-context';

describe('Audit context on detached serverless requests', () => {
  const originalVercel = process.env.VERCEL;
  afterEach(() => {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it.each([false, true])(
    'continues logout with a detached socket (Vercel=%s)',
    (vercel) => {
      process.env.VERCEL = vercel ? '1' : '0';
      const app = express();
      const req = Object.create(app.request) as Request;
      Object.assign(req, {
        socket: null,
        headers: {
          'x-forwarded-for': '198.51.100.99',
          'x-vercel-forwarded-for': '203.0.113.4',
        },
        method: 'POST',
        url: '/api/v1/auth/logout',
      });
      expect(() => req.ip).toThrow();
      const next = jest.fn(() => {
        expect(getAuditContext().ipAddress).toBe(vercel ? '203.0.113.4' : null);
        expect(getAuditContext().endpoint).toBe('/api/v1/auth/logout');
      });
      new AuditContextMiddleware().use(
        req,
        {} as Response,
        next as NextFunction,
      );
      expect(next).toHaveBeenCalledTimes(1);
    },
  );
});
