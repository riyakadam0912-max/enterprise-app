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
    expect(missingReq.organizationId).toBeNull();
    expect(inactiveReq.organizationId).toBeNull();
  });

  it('limits BU-admin header selection to assigned units and descendants', async () => {
    const fakeJwt = new JwtService({ secret: 'test' } as any);
    const prismaMock: any = {
      businessUnitAdmin: {
        findMany: jest.fn().mockResolvedValue([{ businessUnitId: 10 }]),
      },
      businessUnit: {
        findMany: jest.fn().mockResolvedValue([
          { id: 10, parentId: null },
          { id: 11, parentId: 10 },
          { id: 20, parentId: null },
        ]),
      },
    };
    const middleware = new TenantContextMiddleware(fakeJwt, prismaMock);
    const payload = {
      userId: 8,
      role: 'MANAGER',
      roles: ['MANAGER'],
      organizationId: 1,
      primaryBusinessUnitId: null,
    } as any;

    await expect(
      middleware.resolveBusinessUnitContext({}, payload, 1, false, '11'),
    ).resolves.toEqual({ businessUnitId: 11, allBusinessUnits: false });
    await expect(
      middleware.resolveBusinessUnitContext({}, payload, 1, false, '20'),
    ).resolves.toEqual({ businessUnitId: null, allBusinessUnits: false });
    await expect(
      middleware.resolveBusinessUnitContext({}, payload, 1, false, 'ALL'),
    ).resolves.toEqual({ businessUnitId: null, allBusinessUnits: false });
  });

  it('does not let a tenant admin select a business unit from another organization', async () => {
    const fakeJwt = new JwtService({ secret: 'test' } as any);
    const prismaMock: any = {
      businessUnitAdmin: { findMany: jest.fn().mockResolvedValue([]) },
      businessUnit: {
        findMany: jest.fn().mockResolvedValue([{ id: 10, parentId: null }]),
      },
    };
    const middleware = new TenantContextMiddleware(fakeJwt, prismaMock);
    const payload = {
      userId: 5,
      role: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
      organizationId: 1,
      primaryBusinessUnitId: 10,
    } as any;

    await expect(
      middleware.resolveBusinessUnitContext({}, payload, 1, false, '99'),
    ).resolves.toEqual({ businessUnitId: 10, allBusinessUnits: false });
    expect(prismaMock.businessUnitAdmin.findMany).toHaveBeenCalledWith({
      where: { userId: 5, organizationId: 1 },
      select: { businessUnitId: true },
    });
  });
});
