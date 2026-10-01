import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';

export type ProjectMessageMention = {
  type: 'user' | 'task';
  id: number;
  label: string;
  start: number;
  end: number;
};

@Injectable()
export class ProjectMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  private get db() {
    return this.prisma;
  }

  private isPlatformAdmin(user: AuthUser): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.SUPER_ADMIN ||
      user.isPlatformAdmin === true ||
      user.isSuperAdmin === true ||
      user.roles.includes(Role.ADMIN) ||
      user.roles.includes(Role.SUPER_ADMIN)
    );
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

    if (this.isPlatformAdmin(user)) {
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
    this.validateOrganization(requestingUser);
    const allowed = await this.canAccessProjectChat(projectId, requestingUser);
    if (!allowed) {
      throw new ForbiddenException(
        'You can only access messages for projects you belong to',
      );
    }

    const projectScope = await this.projectsService.getProjectAccessWhere(
      requestingUser,
    );
    const project = await this.db.project.findFirst({
      where: { id: projectId, ...projectScope },
      select: { id: true, organizationId: true },
    });
    if (!project) {
      throw new NotFoundException(`Project #${projectId} not found`);
    }

    return this.db.projectMessage.findMany({
      where: { projectId, organizationId: project.organizationId },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getMentionOptions(projectId: number, requestingUser: AuthUser) {
    this.validateOrganization(requestingUser);
    if (!(await this.canAccessProjectChat(projectId, requestingUser))) {
      throw new ForbiddenException(
        'You can only access mentions for projects you belong to',
      );
    }

    const projectScope = await this.projectsService.getProjectAccessWhere(requestingUser);
    const project = await this.db.project.findFirst({
      where: { id: projectId, ...projectScope, deletedAt: null },
      select: {
        organizationId: true,
        managerUser: {
          select: { id: true, name: true, email: true, role: true },
        },
        coManagers: {
          select: { id: true, name: true, email: true, role: true },
        },
        assignedEmployees: {
          where: { deletedAt: null },
          select: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });
    if (!project)
      throw new NotFoundException(`Project #${projectId} not found`);

    const taskWhere: Prisma.TaskWhereInput = {
      organizationId: project.organizationId,
      projectId,
      deletedAt: null,
      ...(requestingUser.role === Role.EMPLOYEE
        ? {
            OR: [
              { assignedToUserId: requestingUser.userId },
              ...(requestingUser.employeeId
                ? [{ assignedToId: requestingUser.employeeId }]
                : []),
            ],
          }
        : {}),
    };
    const tasks = await this.db.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        taskName: true,
        status: true,
        assignedToUser: {
          select: { id: true, name: true, email: true, role: true },
        },
        assignedByUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { taskName: 'asc' },
    });

    const userOptions = new Map<
      number,
      {
        id: number;
        name: string;
        email: string;
        role: string;
      }
    >();
    const addUser = (
      candidate:
        | typeof project.managerUser
        | (typeof tasks)[number]['assignedToUser'],
    ) => {
      if (candidate) {
        userOptions.set(candidate.id, {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          role: String(candidate.role),
        });
      }
    };

    addUser(project.managerUser);
    project.coManagers.forEach(addUser);
    project.assignedEmployees.forEach((employee) => addUser(employee.user));
    tasks.forEach((task) => {
      addUser(task.assignedToUser);
      addUser(task.assignedByUser);
    });

    return {
      users: [...userOptions.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      tasks: tasks.map((task) => ({
        id: task.id,
        name: task.taskName,
        status: task.status,
      })),
    };
  }

  async createMessage(
    projectId: number,
    content: string,
    mentions: ProjectMessageMention[] | undefined,
    requestingUser: AuthUser,
  ) {
    this.validateOrganization(requestingUser);
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

    const projectScope = await this.projectsService.getProjectAccessWhere(
      requestingUser,
    );
    const project = await this.db.project.findFirst({
      where: { id: projectId, ...projectScope },
      select: { id: true, organizationId: true },
    });
    if (!project) {
      throw new NotFoundException(`Project #${projectId} not found`);
    }

    const mentionOptions = await this.getMentionOptions(
      projectId,
      requestingUser,
    );
    if (
      mentions !== undefined &&
      (!Array.isArray(mentions) || mentions.length > 50)
    ) {
      throw new BadRequestException('Invalid project chat mentions');
    }
    const usersById = new Map(
      mentionOptions.users.map((mention) => [mention.id, mention]),
    );
    const tasksById = new Map(
      mentionOptions.tasks.map((mention) => [mention.id, mention]),
    );
    const validatedMentions = (mentions ?? [])
      .map((mention) => {
        if (
          !mention ||
          !Number.isInteger(mention.id) ||
          !Number.isInteger(mention.start) ||
          !Number.isInteger(mention.end) ||
          mention.start < 0 ||
          mention.end <= mention.start ||
          mention.end > message.length
        ) {
          throw new BadRequestException('Invalid project chat mention');
        }
        const target =
          mention.type === 'user'
            ? usersById.get(mention.id)
            : mention.type === 'task'
              ? tasksById.get(mention.id)
              : undefined;
        if (!target) {
          throw new BadRequestException(
            'Mention target is not available in this project',
          );
        }
        const expectedText = `${mention.type === 'user' ? '@' : '#'}${target.name}`;
        if (message.slice(mention.start, mention.end) !== expectedText) {
          throw new BadRequestException(
            'Mention text does not match its target',
          );
        }
        return { ...mention, label: target.name };
      })
      .sort((a, b) => a.start - b.start);

    for (let index = 1; index < validatedMentions.length; index += 1) {
      if (validatedMentions[index].start < validatedMentions[index - 1].end) {
        throw new BadRequestException('Project chat mentions cannot overlap');
      }
    }

    return this.db.projectMessage.create({
      data: {
        projectId,
        senderId: requestingUser.userId,
        content: message,
        ...(validatedMentions.length > 0 && {
          mentions: validatedMentions as Prisma.InputJsonValue,
        }),
        organizationId: project.organizationId,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
