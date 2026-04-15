import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FileAttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(fileName: string, fileUrl: string, entityType: string, entityId: number, uploadedBy: number) {
    return this.prisma.fileAttachment.create({
      data: { fileName, fileUrl, entityType, entityId, uploadedBy },
    });
  }

  async findByEntity(entityType: string, entityId: number) {
    return this.prisma.fileAttachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.fileAttachment.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async remove(id: number) {
    const file = await this.prisma.fileAttachment.findUnique({ where: { id } });
    if (!file) throw new NotFoundException(`File #${id} not found`);
    await this.prisma.fileAttachment.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }
}
