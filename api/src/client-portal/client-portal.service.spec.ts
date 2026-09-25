import { ForbiddenException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';
import { ClientPortalService } from './client-portal.service';

function clientUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    userId: 1,
    email: 'admin@example.com',
    name: 'Admin',
    role: Role.ADMIN,
    roles: [Role.ADMIN],
    permissions: [],
    employeeId: null,
    organizationId: 10,
    tokenType: 'access',
    jti: null,
    ...overrides,
  };
}

describe('ClientPortalService', () => {
  const prisma = {
    clientProfile: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    clientProjectAccess: { findMany: jest.fn() },
    clientInvitation: { findUnique: jest.fn() },
  } as any;
  const emailService = { sendEmailTemplate: jest.fn() } as any;
  const service = new ClientPortalService(prisma, emailService);

  beforeEach(() => jest.clearAllMocks());

  it('rejects client administration without an organization', async () => {
    await expect(
      service.list(clientUser({ organizationId: null })),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.clientProfile.findMany).not.toHaveBeenCalled();
  });

  it('lists only profiles in the authenticated organization', async () => {
    prisma.clientProfile.findMany.mockResolvedValueOnce([{ id: 3 }]);
    await expect(service.list(clientUser())).resolves.toEqual([{ id: 3 }]);
    expect(prisma.clientProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 10 } }),
    );
  });

  it('does not allow a client to read portal projects through an inactive profile', async () => {
    prisma.clientProfile.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.myProjects(clientUser({ role: Role.CLIENT })),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.clientProjectAccess.findMany).not.toHaveBeenCalled();
  });

  it('rejects an expired invitation before changing account state', async () => {
    prisma.clientInvitation.findUnique.mockResolvedValueOnce({
      id: 1,
      clientProfileId: 2,
      expiresAt: new Date(Date.now() - 1000),
      acceptedAt: null,
      revokedAt: null,
      clientProfile: { userId: 8 },
    });
    await expect(
      service.acceptInvitation('expired-token', 'StrongPassword1!'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a client project read when the profile is not active', async () => {
    prisma.clientProfile.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.myProjects(clientUser({ role: Role.CLIENT })),
    ).rejects.toThrow(ForbiddenException);
  });
});
