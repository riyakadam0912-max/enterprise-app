import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { AuthUser } from '../common/types/auth';

const STATUSES = ['Active', 'On Hold', 'Inactive'] as const;

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(dto: CreateContactDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.contact.create({
      data: {
        organization: { connect: { id: organizationId } },
        contactName: dto.contactName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        company: dto.company,
        jobTitle: dto.jobTitle,
        leadSource: dto.leadSource,
        address: dto.address,
        website: dto.website,
        linkedin: dto.linkedin,
        contactStatus: dto.contactStatus,
      },
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.contact.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const contact = await this.prisma.contact.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!contact) throw new NotFoundException(`Contact #${id} not found`);
    return contact;
  }

  async update(id: number, dto: UpdateContactDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.contact.update({
      where: { id, organizationId },
      data: {
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle }),
        ...(dto.leadSource !== undefined && { leadSource: dto.leadSource }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.linkedin !== undefined && { linkedin: dto.linkedin }),
        ...(dto.contactStatus !== undefined && {
          contactStatus: dto.contactStatus,
        }),
      },
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.contact.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async importRecords(
    records: Array<Record<string, unknown>>,
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    const organizationId = this.validateOrganization(user);
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (typeof r.contactName !== 'string' || !r.contactName) {
        errors.push(`Row ${i + 1}: 'contactName' is required`);
        continue;
      }
      try {
        const data: Prisma.ContactCreateInput = {
          organization: { connect: { id: organizationId } },
          contactName: String(r.contactName),
          email: typeof r.email === 'string' ? r.email : undefined,
          phoneNumber:
            typeof r.phoneNumber === 'string' ? r.phoneNumber : undefined,
          company: typeof r.company === 'string' ? r.company : undefined,
          jobTitle: typeof r.jobTitle === 'string' ? r.jobTitle : undefined,
          leadSource:
            typeof r.leadSource === 'string' ? r.leadSource : undefined,
          address: typeof r.address === 'string' ? r.address : undefined,
          website: typeof r.website === 'string' ? r.website : undefined,
          linkedin: typeof r.linkedin === 'string' ? r.linkedin : undefined,
          contactStatus:
            typeof r.contactStatus === 'string' ? r.contactStatus : undefined,
        };

        await this.prisma.contact.create({ data });
        imported++;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${message}`);
      }
    }
    return { imported, errors };
  }

  async getByStatus(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const contacts = await this.prisma.contact.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const grouped: Record<string, typeof contacts> = {};
    for (const s of STATUSES) grouped[s] = [];
    for (const c of contacts) {
      const key = c.contactStatus ?? 'Unknown';
      if (grouped[key]) grouped[key].push(c);
      else grouped[key] = [c];
    }
    return grouped;
  }
}
