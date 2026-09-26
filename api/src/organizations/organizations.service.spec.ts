import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  it('returns the global org list for platform admins even when an active organization is set', async () => {
    const orgs = [
      { id: 1, name: 'Global Org A', code: 'A', slug: 'global-org-a', status: 'ACTIVE', createdAt: new Date(), parentId: null },
      { id: 2, name: 'Global Org B', code: 'B', slug: 'global-org-b', status: 'ACTIVE', createdAt: new Date(), parentId: null },
    ];

    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue(orgs),
      },
    } as any;

    const service = new OrganizationsService(prisma);
    const user = { role: 'SUPER_ADMIN', organizationId: 42, isPlatformAdmin: true } as any;

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
