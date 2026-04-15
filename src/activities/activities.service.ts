import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';

const includeUser = {
  user: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateActivityDto) {
    const prisma = this.prisma as any;
    return prisma.activity.create({
      data: {
        type: dto.type,
        description: dto.description,
        userId: dto.userId,
        leadId: dto.leadId,
        dealId: dto.dealId,
        contactId: dto.contactId,
      },
      include: includeUser,
    });
  }

  async getByLead(leadId: number) {
    const prisma = this.prisma as any;
    return prisma.activity.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: includeUser,
    });
  }

  async getByDeal(dealId: number) {
    const prisma = this.prisma as any;
    return prisma.activity.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
      include: includeUser,
    });
  }

  async getByContact(contactId: number) {
    const prisma = this.prisma as any;
    return prisma.activity.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      include: includeUser,
    });
  }
}
