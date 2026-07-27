import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import type { AuthUser } from '../common/types/auth';

const includeRelations = {
  deal: { select: { id: true, title: true, value: true, stage: true } },
  contact: {
    select: { id: true, contactName: true, email: true, company: true },
  },
  items: true,
};

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(dto: CreateQuoteDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const deal = await this.prisma.deal.findUnique({
      where: { id: dto.dealId, organizationId },
    });
    if (!deal) throw new NotFoundException(`Deal #${dto.dealId} not found`);

    const contact = await this.prisma.contact.findUnique({
      where: { id: dto.contactId, organizationId },
    });
    if (!contact)
      throw new NotFoundException(`Contact #${dto.contactId} not found`);

    const total = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0,
    );

    return this.prisma.quote.create({
      data: {
        organizationId,
        dealId: dto.dealId,
        contactId: dto.contactId,
        total,
        status: dto.status ?? 'DRAFT',
        validTill: new Date(dto.validTill),
        notes: dto.notes,
        items: {
          create: dto.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            organization: {
              connect: { id: organizationId },
            },
          })),
        },
      },
      include: includeRelations,
    });
  }

  findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.quote.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: includeRelations,
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const quote = await this.prisma.quote.findUnique({
      where: { id, organizationId },
      include: includeRelations,
    });
    if (!quote) throw new NotFoundException(`Quote #${id} not found`);
    return quote;
  }

  async update(id: number, dto: UpdateQuoteDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);

    const data: Prisma.QuoteUpdateInput = {};
    if (dto.dealId !== undefined) {
      data.deal = { connect: { id: dto.dealId } };
    }
    if (dto.contactId !== undefined) {
      data.contact = { connect: { id: dto.contactId } };
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.validTill !== undefined) data.validTill = new Date(dto.validTill);

    if (dto.items !== undefined) {
      data.total = dto.items.reduce(
        (sum, item) => sum + item.quantity * item.price,
        0,
      );
      data.items = {
        deleteMany: {},
        create: dto.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          organization: {
            connect: { id: organizationId },
          },
        })),
      };
    }

    return this.prisma.quote.update({
      where: { id, organizationId },
      data,
      include: includeRelations,
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.quote.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async convertToInvoice(id: number, userId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const quote = await this.prisma.quote.findUnique({
      where: { id, organizationId },
      include: { contact: true },
    });
    if (!quote) throw new NotFoundException(`Quote #${id} not found`);

    const invoiceNo = `INV-Q${id}-${Date.now()}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId,
        invoiceNo,
        customer: quote.contact.contactName,
        totalAmount: quote.total,
        status: 'DRAFT',
        issueDate: new Date(),
        dueDate: quote.validTill,
        notes: quote.notes ?? undefined,
        userId,
      },
    });

    // Mark quote as accepted after invoice is created
    await this.prisma.quote.update({
      where: { id, organizationId },
      data: { status: 'CONVERTED' },
    });

    return invoice;
  }
}
