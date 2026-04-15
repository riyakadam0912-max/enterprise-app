import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

const STATUSES = ['Active', 'On Hold', 'Inactive'] as const;

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactDto) {
    return this.prisma.contact.create({
      data: {
        contactName:   dto.contactName,
        email:         dto.email,
        phoneNumber:   dto.phoneNumber,
        company:       dto.company,
        jobTitle:      dto.jobTitle,
        leadSource:    dto.leadSource,
        address:       dto.address,
        website:       dto.website,
        linkedin:      dto.linkedin,
        contactStatus: dto.contactStatus,
      },
    });
  }

  async findAll() {
    return this.prisma.contact.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: number) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException(`Contact #${id} not found`);
    return contact;
  }

  async update(id: number, dto: UpdateContactDto) {
    await this.findOne(id);
    return this.prisma.contact.update({
      where: { id },
      data: {
        ...(dto.contactName   !== undefined && { contactName:   dto.contactName }),
        ...(dto.email         !== undefined && { email:         dto.email }),
        ...(dto.phoneNumber   !== undefined && { phoneNumber:   dto.phoneNumber }),
        ...(dto.company       !== undefined && { company:       dto.company }),
        ...(dto.jobTitle      !== undefined && { jobTitle:      dto.jobTitle }),
        ...(dto.leadSource    !== undefined && { leadSource:    dto.leadSource }),
        ...(dto.address       !== undefined && { address:       dto.address }),
        ...(dto.website       !== undefined && { website:       dto.website }),
        ...(dto.linkedin      !== undefined && { linkedin:      dto.linkedin }),
        ...(dto.contactStatus !== undefined && { contactStatus: dto.contactStatus }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.contact.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.contactName) { errors.push(`Row ${i + 1}: 'contactName' is required`); continue; }
      try {
        await this.prisma.contact.create({
          data: {
            contactName:   String(r.contactName),
            email:         r.email         ? String(r.email)         : undefined,
            phoneNumber:   r.phoneNumber   ? String(r.phoneNumber)   : undefined,
            company:       r.company       ? String(r.company)       : undefined,
            jobTitle:      r.jobTitle      ? String(r.jobTitle)      : undefined,
            leadSource:    r.leadSource    ? String(r.leadSource)    : undefined,
            address:       r.address       ? String(r.address)       : undefined,
            website:       r.website       ? String(r.website)       : undefined,
            linkedin:      r.linkedin      ? String(r.linkedin)      : undefined,
            contactStatus: r.contactStatus ? String(r.contactStatus) : undefined,
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }

  async getByStatus() {
    const contacts = await this.prisma.contact.findMany({ orderBy: { createdAt: 'desc' } });
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
