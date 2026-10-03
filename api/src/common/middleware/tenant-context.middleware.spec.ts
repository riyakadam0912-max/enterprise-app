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

  it('rejects sibling and ancestor organization selection for a child admin', async () => {
    const middleware = createMiddleware();

    await expect(
      (middleware as any).resolveOrganizationAdminOrganization(
        {
          role: Role.ADMIN,
          organizationId: 2,
        },
        3,
      ),
    ).resolves.toBeNull();
    await expect(
      (middleware as any).resolveOrganizationAdminOrganization(
        {
          role: Role.ADMIN,
          organizationId: 2,
        },
        1,
      ),
    ).resolves.toBeNull();
  });

  it('returns 403 instead of falling back when an admin selects a sibling org', async () => {
    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue(organizations),
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

    expect(response.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('outside your authorized'),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
