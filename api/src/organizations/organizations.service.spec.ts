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

  it('uploads a logo for an organization in the admin home family and stores its object path', async () => {
    const prisma = {
      organization: {
        findFirst: jest.fn().mockResolvedValue({ id: 3, parentId: 2 }),
        findUnique: jest.fn().mockResolvedValue({ id: 2, parentId: null }),
        update: jest.fn().mockResolvedValue({ id: 3 }),
      },
    } as any;
    const fileManagement = {
      uploadOrganizationLogo: jest.fn().mockResolvedValue({
        path: 'organizations/organization/3/logo/logo.png',
        url: 'signed-logo-url',
      }),
    } as any;
    const service = new OrganizationsService(prisma, fileManagement);

    const result = await service.uploadOrganizationLogo(
      3,
      {
        originalname: 'logo.png',
        mimetype: 'image/png',
        size: 100,
      } as Express.Multer.File,
      {
        id: 7,
        userId: 7,
        role: 'ADMIN',
        roles: ['ADMIN'],
        organizationId: 2,
        homeOrganizationId: 2,
      } as any,
    );

    expect(fileManagement.uploadOrganizationLogo).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: 'logo.png' }),
      3,
      expect.objectContaining({ organizationId: 3, userId: 7 }),
    );
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { logoUrl: 'organizations/organization/3/logo/logo.png' },
    });
    expect(result).toEqual({ logoUrl: 'signed-logo-url' });
  });

  it('rejects organization logo uploads outside the admin home family', async () => {
    const prisma = {
      organization: {
        findFirst: jest.fn().mockResolvedValue({ id: 9, parentId: null }),
      },
    } as any;
    const fileManagement = { uploadOrganizationLogo: jest.fn() } as any;
    const service = new OrganizationsService(prisma, fileManagement);

    await expect(
      service.uploadOrganizationLogo(
        9,
        {
          originalname: 'logo.png',
          mimetype: 'image/png',
          size: 100,
        } as Express.Multer.File,
        {
          id: 7,
          userId: 7,
          role: 'ADMIN',
          roles: ['ADMIN'],
          organizationId: 2,
          homeOrganizationId: 2,
        } as any,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(fileManagement.uploadOrganizationLogo).not.toHaveBeenCalled();
  });
});
