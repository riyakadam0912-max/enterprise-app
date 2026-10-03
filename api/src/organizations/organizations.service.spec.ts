import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  it('limits selectable organizations to the admin home organization subtree', async () => {
    const organizations = [
      { id: 1, name: 'Parent', parentId: null },
      { id: 2, name: 'Home', parentId: 1 },
      { id: 3, name: 'Sibling', parentId: 1 },
      { id: 4, name: 'Descendant', parentId: 2 },
      { id: 5, name: 'Unrelated', parentId: null },
    ];
    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue(organizations),
      },
    } as any;
    const service = new OrganizationsService(prisma);

    const result = await service.getAccessibleOrganizations({
      role: 'ADMIN',
      organizationId: 2,
    } as any);

    expect(result.map((organization) => organization.id)).toEqual([2, 4]);
    expect(prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
    );
  });

  it('returns the global org list for platform admins even when an active organization is set', async () => {
    const orgs = [
      {
        id: 1,
        name: 'Global Org A',
        code: 'A',
        slug: 'global-org-a',
        status: 'ACTIVE',
        createdAt: new Date(),
        parentId: null,
      },
      {
        id: 2,
        name: 'Global Org B',
        code: 'B',
        slug: 'global-org-b',
        status: 'ACTIVE',
        createdAt: new Date(),
        parentId: null,
      },
    ];

    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue(orgs),
      },
    } as any;

    const service = new OrganizationsService(prisma);
    const user = {
      role: 'SUPER_ADMIN',
      organizationId: 42,
      isPlatformAdmin: true,
    } as any;

    const result = await service.listOrganizationsForUser(user);

    expect(result).toHaveLength(2);
    expect(result.map((org) => org.id)).toEqual([1, 2]);
    expect(prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
      }),
    );
  });
});
