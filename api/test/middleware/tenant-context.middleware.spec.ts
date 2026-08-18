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

  it('ignores X-Organization-Id for normal tenant users and keeps verified organization context', async () => {
    const fakeJwt = new JwtService({ secret: 'test' } as any);
    jest.spyOn(fakeJwt, 'verify' as any).mockImplementation(() => ({
      userId: 12,
      role: 'ADMIN',
      organizationId: 7,
      isPlatformAdmin: false,
      isSuperAdmin: false,
    }));

    const prismaMock: any = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: 7, status: 'ACTIVE' }),
      },
    };

    const mw = new TenantContextMiddleware(fakeJwt as any, prismaMock as any);

    const req: any = {
      headers: { 'x-organization-id': '99' },
      cookies: { enterprise_access_token: 'tenant-token' },
    };
    const next = jest.fn();

    await mw.use(req, {} as any, next as any);

    expect(req.organizationId).toBe(7);
    expect(prismaMock.organization.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { id: true, status: true },
    });
  });

  it('allows a super admin to select an active organization and rejects inactive/nonexistent selections', async () => {
    const fakeJwt = new JwtService({ secret: 'test' } as any);
    jest.spyOn(fakeJwt, 'verify' as any).mockImplementation(() => ({
      userId: 1,
      role: 'SUPER_ADMIN',
      organizationId: null,
      isPlatformAdmin: true,
      isSuperAdmin: true,
    }));

    const prismaMock: any = {
      organization: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 5, status: 'ACTIVE' })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 8, status: 'INACTIVE' }),
      },
    };

    const mw = new TenantContextMiddleware(fakeJwt as any, prismaMock as any);

    const activeReq: any = {
      headers: { 'x-organization-id': '5' },
      cookies: { enterprise_access_token: 'active-token' },
    };
    const missingReq: any = {
      headers: { 'x-organization-id': '404' },
      cookies: { enterprise_access_token: 'missing-token' },
    };
    const inactiveReq: any = {
      headers: { 'x-organization-id': '8' },
      cookies: { enterprise_access_token: 'inactive-token' },
    };

    await mw.use(activeReq, {} as any, jest.fn());
    await mw.use(missingReq, {} as any, jest.fn());
    await mw.use(inactiveReq, {} as any, jest.fn());

    expect(activeReq.organizationId).toBe(5);
    expect(missingReq.organizationId).toBeUndefined();
    expect(inactiveReq.organizationId).toBeUndefined();
  });
});
