import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Permission } from '../common/enums/permissions.enum';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMarketingPostDto } from './dto/create-marketing-post.dto';
import { UpdateMarketingPostDto } from './dto/update-marketing-post.dto';

@Injectable()
export class MarketingPostsService {
  constructor(private readonly prisma: PrismaService) {}

  private organizationId(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private assertPermission(user: AuthUser, permission: Permission) {
    if (
      user.role === Role.ADMIN ||
      user.role === Role.SUPER_ADMIN ||
      user.isPlatformAdmin ||
      user.isSuperAdmin ||
      user.permissions?.includes(permission)
    ) {
      return;
    }
    throw new ForbiddenException('Missing required marketing permission');
  }

  private validateSchedule(scheduledAt: string | undefined, status: string) {
    if (status !== 'SCHEDULED') return;
    if (!scheduledAt) {
      throw new BadRequestException('A scheduled date and time is required');
    }
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }
    if (date.getMinutes() % 15 !== 0 || date.getSeconds() !== 0 || date.getMilliseconds() !== 0) {
      throw new BadRequestException('Scheduled time must use 15-minute intervals');
    }
  }

  list(user: AuthUser) {
    return this.prisma.marketingPost.findMany({
      where: { organizationId: this.organizationId(user), deletedAt: null },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(dto: CreateMarketingPostDto, user: AuthUser) {
    this.assertPermission(user, Permission.MARKETING_CREATE);
    const status = dto.status ?? (dto.scheduledAt ? 'SCHEDULED' : 'DRAFT');
    this.validateSchedule(dto.scheduledAt, status);
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('Post content is required');

    return this.prisma.marketingPost.create({
      data: {
        organizationId: this.organizationId(user),
        content,
        platform: dto.platform,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status,
      },
    });
  }

  async update(id: number, dto: UpdateMarketingPostDto, user: AuthUser) {
    this.assertPermission(user, Permission.MARKETING_UPDATE);
    const organizationId = this.organizationId(user);
    const post = await this.prisma.marketingPost.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!post) throw new NotFoundException(`Marketing post #${id} not found`);

    const status = dto.status ?? post.status;
    const scheduledAt = dto.scheduledAt !== undefined
      ? dto.scheduledAt
      : post.scheduledAt?.toISOString();
    this.validateSchedule(scheduledAt, status);
    const content = dto.content !== undefined ? dto.content.trim() : undefined;
    if (content !== undefined && !content) {
      throw new BadRequestException('Post content is required');
    }

    return this.prisma.marketingPost.update({
      where: { id },
      data: {
        ...(content !== undefined && { content }),
        ...(dto.platform !== undefined && { platform: dto.platform }),
        ...(dto.scheduledAt !== undefined && {
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(id: number, user: AuthUser) {
    this.assertPermission(user, Permission.MARKETING_DELETE);
    const organizationId = this.organizationId(user);
    const post = await this.prisma.marketingPost.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!post) throw new NotFoundException(`Marketing post #${id} not found`);
    return this.prisma.marketingPost.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}