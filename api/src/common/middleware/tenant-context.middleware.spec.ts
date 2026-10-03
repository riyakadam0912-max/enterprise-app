import { Role } from '../enums/role.enum';
import { TenantContextMiddleware } from './tenant-context.middleware';

describe('TenantContextMiddleware organization selection', () => {
  const organizations = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
    { id: 3, parentId: 1 },
    { id: 4, parentId: 2 },
    { id: 5, parentId: null },
  ];

  function createMiddleware() {
    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue(organizations),
      },
      businessUnitAdmin: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    return new TenantContextMiddleware({} as any, prisma as any);
  }

  it('allows a parent admin to select an active descendant organization', async () => {
    const middleware = createMiddleware();

    await expect(
      (middleware as any).resolveOrganizationAdminOrganization(
        {
          role: Role.ADMIN,
          organizationId: 1,
        },
        2,
      ),
    ).resolves.toBe(2);
  });

  it('allows organization admins to select parent, sibling, and child organizations', async () => {
    const middleware = createMiddleware();

    await expect(
      (middleware as any).resolveOrganizationAdminOrganization(
        {
          role: Role.ADMIN,
          organizationId: 2,
        },
        3,
      ),
    ).resolves.toBe(3);
    await expect(
      (middleware as any).resolveOrganizationAdminOrganization(
        {
          role: Role.ADMIN,
          organizationId: 2,
        },
        1,
      ),
    ).resolves.toBe(1);
    await expect(
      (middleware as any).resolveOrganizationAdminOrganization(
        {
          role: Role.ADMIN,
          organizationId: 2,
        },
        4,
      ),
    ).resolves.toBe(4);
  });

  it('allows an organization admin without a home organization to select any active organization', async () => {
    const middleware = createMiddleware();

    await expect(
      (middleware as any).resolveOrganizationAdminOrganization(
        { role: Role.ADMIN },
        3,
      ),
    ).resolves.toBe(3);
  });

  it('keeps HR organization selection limited to its home subtree', async () => {
    const middleware = createMiddleware();

    await expect(
      (middleware as any).resolveOrganizationAdminOrganization(
        { role: Role.HR, organizationId: 2 },
        3,
      ),
    ).resolves.toBeNull();
  });

  it('allows a BU admin to select only an organization with an active assignment', async () => {
    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue(organizations),
      },
      businessUnitAdmin: {
        findFirst: jest.fn().mockResolvedValue({ organizationId: 4 }),
      },
    };
    const middleware = new TenantContextMiddleware({} as any, prisma as any);

    await expect(
      (middleware as any).resolveBusinessUnitAdminOrganization(
        { userId: 10 },
        4,
      ),
    ).resolves.toBe(4);
    expect(prisma.businessUnitAdmin.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 10,
          organizationId: 4,
          businessUnit: { status: 'ACTIVE' },
        }),
      }),
    );
  });

  it('resolves a sibling organization in middleware for an organization admin', async () => {
    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue(organizations),
      },
      businessUnitAdmin: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const jwtService = {
      verify: jest.fn().mockReturnValue({
        sub: 10,
        userId: 10,
        role: Role.ADMIN,
        roles: [Role.ADMIN],
        organizationId: 2,
        homeOrganizationId: 2,
      }),
    };
    const middleware = new TenantContextMiddleware(
      jwtService as any,
      prisma as any,
    );
    const next = jest.fn();
    const json = jest.fn();
    const response = { status: jest.fn().mockReturnValue({ json }) };
    const request = {
      cookies: { enterprise_access_token: 'valid-token' },
      headers: { 'x-organization-id': '3' },
    };

    await middleware.use(request as any, response as any, next);

    expect(response.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(request).toHaveProperty('organizationId', 3);
  });
});
