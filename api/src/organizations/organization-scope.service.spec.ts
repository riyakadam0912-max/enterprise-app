import { OrganizationScopeService } from './organization-scope.service';
import { Role } from '../common/enums/role.enum';

describe('OrganizationScopeService', () => {
  it('returns the organization and all active descendants for an admin', async () => {
    const organization = {
      findMany: jest.fn().mockResolvedValue([
        { id: 1, parentId: null },
        { id: 2, parentId: 1 },
        { id: 3, parentId: 2 },
      ]),
    };
    const service = new OrganizationScopeService({ organization } as any);

    await expect(
      service.getOrganizationIds({
        role: Role.ADMIN,
        roles: [Role.ADMIN],
        organizationId: 1,
        homeOrganizationId: 1,
      } as any),
    ).resolves.toEqual([1, 2, 3]);
    expect(organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE', deletedAt: null }),
      }),
    );
  });

  it('keeps employee scope to its own organization', async () => {
    const organization = { findMany: jest.fn() };
    const service = new OrganizationScopeService({ organization } as any);

    await expect(
      service.getOrganizationIds({
        role: Role.EMPLOYEE,
        roles: [Role.EMPLOYEE],
        organizationId: 4,
      } as any),
    ).resolves.toEqual([4]);
    expect(organization.findMany).not.toHaveBeenCalled();
  });

  it('returns parent, siblings, and descendants for project collaboration', async () => {
    const organization = {
      findMany: jest.fn().mockResolvedValue([
        { id: 1, parentId: null },
        { id: 2, parentId: 1 },
        { id: 3, parentId: 1 },
        { id: 4, parentId: 2 },
        { id: 5, parentId: null },
      ]),
    };
    const service = new OrganizationScopeService({ organization } as any);

    await expect(service.getRelatedOrganizationIds(2)).resolves.toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('returns only the selected organization subtree for attendance context', async () => {
    const organization = {
      findMany: jest.fn().mockResolvedValue([
        { id: 1, parentId: null },
        { id: 2, parentId: 1 },
        { id: 3, parentId: 1 },
        { id: 4, parentId: 2 },
        { id: 5, parentId: null },
      ]),
    };
    const service = new OrganizationScopeService({ organization } as any);

    await expect(service.getDescendantOrganizationIds(2)).resolves.toEqual([
      2, 4,
    ]);
    await expect(service.getOrganizationFamilyRootId(4)).resolves.toBe(1);
  });

  it('returns global scope only for an unscoped platform admin', async () => {
    const service = new OrganizationScopeService({ organization: {} } as any);

    await expect(
      service.getOrganizationIds({
        role: Role.SUPER_ADMIN,
        roles: [Role.SUPER_ADMIN],
        organizationId: null,
      } as any),
    ).resolves.toBeNull();
  });
});
