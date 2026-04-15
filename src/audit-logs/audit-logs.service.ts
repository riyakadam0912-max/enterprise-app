import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAuditLogDto) {
    return this.prisma.auditLog.create({ data: dto });
  }

  async findAll() {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  }

  async findByEntity(entity: string, entityId: number) {
    return this.prisma.auditLog.findMany({ where: { entity, entityId }, orderBy: { createdAt: 'desc' } });
  }
}
