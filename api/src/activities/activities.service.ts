import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { AuthUser } from '../common/types/auth';
import { Prisma } from '@prisma/client';

const includeUser = {
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ActivityInclude;

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new BadRequestException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(dto: CreateActivityDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.activity.create({
      data: {
        type: dto.type,
        description: dto.description,
        userId: dto.userId,
        leadId: dto.leadId,
        dealId: dto.dealId,
        contactId: dto.contactId,
        organizationId,
      },
      include: includeUser,
    });
  }

  async getByLead(leadId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.activity.findMany({
      where: { leadId, organizationId },
      orderBy: { createdAt: 'desc' },
      include: includeUser,
    });
  }

  async getByDeal(dealId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.activity.findMany({
      where: { dealId, organizationId },
      orderBy: { createdAt: 'desc' },
      include: includeUser,
    });
  }

  async getByContact(contactId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.activity.findMany({
      where: { contactId, organizationId },
      orderBy: { createdAt: 'desc' },
      include: includeUser,
    });
  }
}
