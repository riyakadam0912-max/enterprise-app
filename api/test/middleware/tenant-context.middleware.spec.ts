import { TenantContextMiddleware } from '../../src/common/middleware/tenant-context.middleware';
import { JwtService } from '@nestjs/jwt';

describe('TenantContextMiddleware', () => {
  it('injects organizationId when token is platform admin and header valid', async () => {
    const fakeJwt = new JwtService({ secret: 'test' } as any);
    jest
      .spyOn(fakeJwt, 'verify' as any)
      .mockImplementation(() => ({ isPlatformAdmin: true }));

    const prismaMock: any = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: 5, status: 'ACTIVE' }),
      },
    };

    const mw = new TenantContextMiddleware(fakeJwt as any, prismaMock as any);

    const req: any = {
      headers: { 'x-organization-id': '5' },
      cookies: { enterprise_access_token: 'test-token' },
    };
    const next = jest.fn();

    await mw.use(req, {} as any, next as any);

    expect(req.organizationId).toBe(5);
    expect(next).toHaveBeenCalled();
  });

  it('does not inject organizationId when header is invalid', async () => {
    const fakeJwt = new JwtService({ secret: 'test' } as any);
    jest
      .spyOn(fakeJwt, 'verify' as any)
      .mockImplementation(() => ({ isPlatformAdmin: true }));

    const prismaMock: any = {
      organization: { findUnique: jest.fn() },
    };

    const mw = new TenantContextMiddleware(fakeJwt as any, prismaMock as any);

    const req: any = { headers: { 'x-organization-id': 'abc' }, cookies: {} };
    const next = jest.fn();

    await mw.use(req, {} as any, next as any);

    expect(req.organizationId).toBeUndefined();
    expect(next).toHaveBeenCalled();
    expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
  });
});
