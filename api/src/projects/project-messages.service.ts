import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';

@Injectable()
export class ProjectMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma;
  }

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private async getScopedUser(user: AuthUser) {
    const scopedUser = await this.db.user.findUnique({
      where: { id: user.userId },
      select: { id: true, role: true, managerId: true, employeeId: true },
    });
    if (!scopedUser) {
      throw new ForbiddenException('User not found');
    }
    return scopedUser;
  }

  /**
   * Centralized access control for project chat
   */
  private async canAccessProjectChat(
    projectId: number,
    user: AuthUser,
  ): Promise<boolean> {
    const organizationId = this.validateOrganization(user);

    if (user.role === Role.ADMIN) {
      return true;
    }

    if (user.role === Role.MANAGER) {
      const project = await this.db.project.findFirst({
        where: {
          id: projectId,
          organizationId,
          OR: [
            { managerId: user.userId },
            { coManagers: { some: { id: user.userId } } },
          ],
        },
        select: { id: true },
      });
      const allowed = Boolean(project);
      return allowed;
    }

    const scopedUser = await this.getScopedUser(user);
    if (!scopedUser.employeeId) {
      return false;
    }

    const project = await this.db.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        OR: [
          { assignedEmployees: { some: { id: scopedUser.employeeId } } },
          {
            tasks: {
              some: {
                OR: [
                  { assignedToUserId: user.userId },
                  { assignedToId: scopedUser.employeeId },
                ],
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    const allowed = Boolean(project);
    return allowed;
  }

  async getMessages(projectId: number, requestingUser: AuthUser) {
    const organizationId = this.validateOrganization(requestingUser);
    const allowed = await this.canAccessProjectChat(projectId, requestingUser);
    if (!allowed) {
      throw new ForbiddenException(
        'You can only access messages for projects you belong to',
      );
    }

    const project = await this.db.project.findUnique({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Project #${projectId} not found`);
    }

    return this.db.projectMessage.findMany({
      where: { projectId, organizationId },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMessage(
    projectId: number,
    content: string,
    requestingUser: AuthUser,
  ) {
    const organizationId = this.validateOrganization(requestingUser);
    const message = content?.trim();
    if (!message) {
      throw new ForbiddenException('Message content is required');
    }

    const allowed = await this.canAccessProjectChat(projectId, requestingUser);
    if (!allowed) {
      throw new ForbiddenException(
        'You can only message projects you belong to',
      );
    }

    const project = await this.db.project.findUnique({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Project #${projectId} not found`);
    }

    return this.db.projectMessage.create({
      data: {
        projectId,
        senderId: requestingUser.userId,
        content: message,
        organizationId,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
