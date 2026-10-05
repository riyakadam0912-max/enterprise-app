import { ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  it('limits organization admins to their organization family', async () => {
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

    expect(result.map((organization) => organization.id)).toEqual([1, 2, 3, 4]);
    expect(prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
    );
  });

  it('denies organization switching when an admin has no home organization', async () => {
    const organizations = [{ id: 1, name: 'Active Org', parentId: null }];
    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue(organizations),
      },
    } as any;
    const service = new OrganizationsService(prisma);

    await expect(
      service.getAccessibleOrganizations({ role: 'ADMIN' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('limits a business unit admin to organizations with active assignments', async () => {
    const organizations = [
      { id: 2, name: 'Assigned', parentId: null },
      { id: 3, name: 'Unassigned', parentId: null },
    ];
    const prisma = {
      businessUnitAdmin: {
        findMany: jest.fn().mockResolvedValue([{ organizationId: 2 }]),
      },
      organization: {
        findMany: jest.fn().mockResolvedValue(organizations),
      },
    } as any;
    const service = new OrganizationsService(prisma);

    const result = await service.getAccessibleOrganizations({
      id: 10,
      userId: 10,
      role: 'EMPLOYEE',
      organizationId: 3,
    } as any);

    expect(result.map((organization) => organization.id)).toEqual([2]);
    expect(prisma.businessUnitAdmin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 10,
          businessUnit: { status: 'ACTIVE' },
        }),
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
