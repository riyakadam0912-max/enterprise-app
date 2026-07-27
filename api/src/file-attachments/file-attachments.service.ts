import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth';

@Injectable()
export class FileAttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(
    fileName: string,
    fileUrl: string,
    entityType: string,
    entityId: number,
    uploadedBy: number,
    user: AuthUser,
    fileKey?: string,
  ) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.fileAttachment.create({
      data: {
        organizationId,
        fileName,
        fileUrl,
        fileKey,
        entityType,
        entityId,
        uploadedBy,
      },
    });
  }

  async findByEntity(entityType: string, entityId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.fileAttachment.findMany({
      where: { entityType, entityId, organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.fileAttachment.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const file = await this.prisma.fileAttachment.findUnique({
      where: { id, organizationId },
    });
    if (!file) throw new NotFoundException(`File #${id} not found`);
    await this.prisma.fileAttachment.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }
}
