import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientAccessStatus, ClientProfileStatus, Role } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { hashPassword } from '../users/utils/hash-password';
import { Permission } from '../common/enums/permissions.enum';
import type { AuthUser } from '../common/types/auth';
import type { CreateClientUserDto } from './dto/create-client-user.dto';

@Injectable()
export class ClientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private organizationId(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private canManage(user: AuthUser): boolean {
    return (
      [
        Role.ADMIN,
        Role.SUPER_ADMIN,
        Role.COMPLIANCE_MANAGER,
        Role.MANAGER,
      ].some((role) => role === user.role) ||
      user.permissions?.includes(Permission.CLIENT_CREATE) ||
      user.permissions?.includes(Permission.CLIENT_PROJECT_ACCESS_MANAGE) ||
      user.isPlatformAdmin === true ||
      user.isSuperAdmin === true
    );
  }

  private assertManager(user: AuthUser) {
    if (!this.canManage(user))
      throw new ForbiddenException('Client management access denied');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async list(user: AuthUser) {
    this.assertManager(user);
    const organizationId = this.organizationId(user);
    return this.prisma.clientProfile.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            customerName: true,
            customerType: true,
            email: true,
          },
        },
        user: { select: { id: true, name: true, email: true, isActive: true } },
        projectAccess: {
          where: { accessStatus: ClientAccessStatus.ACTIVE },
          include: {
            project: {
              select: {
                id: true,
                projectName: true,
                status: true,
                projectCode: true,
              },
            },
          },
        },
      },
    });
  }

  async create(dto: CreateClientUserDto, user: AuthUser) {
    this.assertManager(user);
    const organizationId = this.organizationId(user);
    const email = this.normalizeEmail(dto.email);
    const projectIds = [...new Set(dto.projectIds)];
    if (projectIds.length === 0)
      throw new ConflictException('At least one project is required');

    const [contact, projects, existingUser] = await Promise.all([
      this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId, deletedAt: null },
      }),
      this.prisma.project.findMany({
        where: { id: { in: projectIds }, organizationId, deletedAt: null },
        select: { id: true, projectName: true, status: true, managerId: true },
      }),
      this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          role: true,
          clientProfile: { select: { id: true } },
        },
      }),
    ]);

    if (!contact) throw new NotFoundException('Customer not found');
    if (projects.length !== projectIds.length)
      throw new NotFoundException(
        'One or more projects are not available in this organization',
      );
    if (
      user.role === Role.MANAGER &&
      projects.some((project) => project.managerId !== user.userId)
    ) {
      throw new ForbiddenException(
        'Managers may only assign projects they manage',
      );
    }
    if (existingUser)
      throw new ConflictException('Email already has an account');

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const temporaryPassword = await hashPassword(
      randomBytes(24).toString('base64'),
    );
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const name = contact.customerName || email.split('@')[0];
    const template = dto.invitationTemplate?.trim() || 'client-invitation';

    const clientProfile = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          password: temporaryPassword,
          role: Role.CLIENT,
          isActive: false,
          organizationId,
        },
      });
      const profile = await tx.clientProfile.create({
        data: {
          organizationId,
          userId: createdUser.id,
          customerId: contact.id,
          projectAccess: {
            create: projectIds.map((projectId) => ({ projectId })),
          },
        },
        include: { projectAccess: true },
      });
      await tx.clientInvitation.create({
        data: {
          clientProfileId: profile.id,
          organizationId,
          tokenHash,
          template,
          expiresAt,
        },
      });
      return profile;
    });

    const portalUrl = `${process.env.WEB_APP_URL ?? process.env.FRONTEND_URL ?? ''}/client/accept-invitation?token=${rawToken}`;
    await this.emailService.sendEmailTemplate({
      to: email,
      subject: 'You are invited to the client portal',
      template,
      category: 'client-invitation',
      context: {
        firstName: name,
        organization: user.organizationName ?? 'your organization',
        customerName: contact.customerName,
        projectNames: projects.map((project) => project.projectName).join(', '),
        ctaUrl: portalUrl,
        ctaText: 'Accept invitation',
        invitationExpiry: '72 hours',
      },
    });

    return {
      id: clientProfile.id,
      email,
      status: ClientProfileStatus.INVITED,
      expiresAt,
    };
  }

  async updateProjects(clientId: number, projectIds: number[], user: AuthUser) {
    this.assertManager(user);
    const organizationId = this.organizationId(user);
    const profile = await this.prisma.clientProfile.findFirst({
      where: { id: clientId, organizationId },
    });
    if (!profile) throw new NotFoundException('Client user not found');
    const uniqueProjectIds = [...new Set(projectIds)];
    const projects = await this.prisma.project.findMany({
      where: { id: { in: uniqueProjectIds }, organizationId, deletedAt: null },
      select: { id: true, managerId: true },
    });
    if (projects.length !== uniqueProjectIds.length)
      throw new NotFoundException(
        'One or more projects are not available in this organization',
      );
    if (
      user.role === Role.MANAGER &&
      projects.some((project) => project.managerId !== user.userId)
    ) {
      throw new ForbiddenException(
        'Managers may only assign projects they manage',
      );
    }
    await this.prisma.$transaction([
      this.prisma.clientProjectAccess.updateMany({
        where: {
          clientProfileId: clientId,
          accessStatus: ClientAccessStatus.ACTIVE,
        },
        data: {
          accessStatus: ClientAccessStatus.REVOKED,
          revokedAt: new Date(),
        },
      }),
      ...uniqueProjectIds.map((projectId) =>
        this.prisma.clientProjectAccess.upsert({
          where: {
            clientProfileId_projectId: { clientProfileId: clientId, projectId },
          },
          update: { accessStatus: ClientAccessStatus.ACTIVE, revokedAt: null },
          create: { clientProfileId: clientId, projectId },
        }),
      ),
    ]);
    return this.get(clientId, user);
  }

  async get(clientId: number, user: AuthUser) {
    this.assertManager(user);
    return this.prisma.clientProfile.findFirstOrThrow({
      where: { id: clientId, organizationId: this.organizationId(user) },
      include: {
        contact: true,
        user: { select: { id: true, name: true, email: true, isActive: true } },
        projectAccess: { include: { project: true } },
      },
    });
  }

  async acceptInvitation(token: string, password: string) {
    const tokenHash = createHash('sha256').update(token.trim()).digest('hex');
    const invitation = await this.prisma.clientInvitation.findUnique({
      where: { tokenHash },
      include: { clientProfile: true },
    });
    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.acceptedAt ||
      invitation.expiresAt <= new Date()
    )
      throw new ForbiddenException('Invitation is invalid or expired');
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: invitation.clientProfile.userId },
        data: { password: passwordHash, isActive: true },
      }),
      this.prisma.clientProfile.update({
        where: { id: invitation.clientProfileId },
        data: { status: ClientProfileStatus.ACTIVE, acceptedAt: new Date() },
      }),
      this.prisma.clientInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
    return { message: 'Invitation accepted. You can now sign in.' };
  }

  async myProjects(user: AuthUser) {
    if (user.role !== Role.CLIENT)
      throw new ForbiddenException('Client portal access required');
    const profile = await this.prisma.clientProfile.findFirst({
      where: {
        userId: user.userId,
        organizationId: this.organizationId(user),
        status: ClientProfileStatus.ACTIVE,
      },
    });
    if (!profile)
      throw new ForbiddenException('Client portal access is inactive');
    return this.prisma.clientProjectAccess.findMany({
      where: {
        clientProfileId: profile.id,
        accessStatus: ClientAccessStatus.ACTIVE,
      },
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            projectCode: true,
            status: true,
            startDate: true,
            endDate: true,
            description: true,
            finalDeliverablesLink: true,
          },
        },
      },
      orderBy: { project: { projectName: 'asc' } },
    });
  }
}
