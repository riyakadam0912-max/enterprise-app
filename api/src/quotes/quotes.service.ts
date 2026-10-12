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
import { Role } from '../common/enums/role.enum';

const includeRelations = {
  deal: { select: { id: true, title: true, value: true, stage: true } },
  contact: {
    select: { id: true, contactName: true, email: true, company: true },
  },
  customer: true,
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

  private resolveReadScope(user: AuthUser): number | null {
    if (
      !user.organizationId &&
      (user.isSuperAdmin || user.role === Role.SUPER_ADMIN)
    ) {
      return null;
    }
    return this.validateOrganization(user);
  }

  async create(dto: CreateQuoteDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    if (dto.dealId) {
      const deal = await this.prisma.deal.findFirst({
        where: { id: dto.dealId, organizationId },
      });
      if (!deal) throw new NotFoundException(`Deal #${dto.dealId} not found`);
    }
    if (dto.contactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.contactId, organizationId },
      });
      if (!contact)
        throw new NotFoundException(`Contact #${dto.contactId} not found`);
    }
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId },
      });
      if (!customer)
        throw new NotFoundException(`Customer #${dto.customerId} not found`);
    }

    const subtotal = dto.items.reduce(
      (sum, item) =>
        sum + item.quantity * item.price - (item.discountAmount ?? 0),
      0,
    );
    const taxAmount =
      dto.taxAmount ??
      dto.items.reduce(
        (sum, item) =>
          sum +
          (Math.max(
            0,
            item.quantity * item.price - (item.discountAmount ?? 0),
          ) *
            (item.taxRate ?? 0)) /
            100,
        0,
      );
    const total =
      subtotal -
      (dto.discountAmount ?? 0) +
      taxAmount +
      (dto.adjustmentAmount ?? 0);

    return this.prisma.quote.create({
      data: {
        organizationId,
        dealId: dto.dealId,
        contactId: dto.contactId,
        customerId: dto.customerId,
        name: dto.name,
        quoteDate: dto.quoteDate ? new Date(dto.quoteDate) : undefined,
        customerAddress: dto.customerAddress,
        total,
        subtotal,
        discountAmount: dto.discountAmount ?? 0,
        taxAmount,
        adjustmentAmount: dto.adjustmentAmount ?? 0,
        status: dto.status ?? 'DRAFT',
        validTill: new Date(dto.validTill),
        notes: dto.notes,
        termsAndConditions: dto.termsAndConditions,
        templateKey: dto.templateKey ?? 'minimal',
        items: {
          create: dto.items.map((item) => ({
            name: item.name,
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            discountAmount: item.discountAmount ?? 0,
            taxRate: item.taxRate,
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
    const organizationId = this.resolveReadScope(user);
    return this.prisma.quote.findMany({
      where: organizationId == null ? {} : { organizationId },
      orderBy: { createdAt: 'desc' },
      include: includeRelations,
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.resolveReadScope(user);
    const quote = await this.prisma.quote.findUnique({
      where: { id, ...(organizationId == null ? {} : { organizationId }) },
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
      data.deal = dto.dealId
        ? { connect: { id: dto.dealId } }
        : { disconnect: true };
    }
    if (dto.contactId !== undefined) {
      data.contact = dto.contactId
        ? { connect: { id: dto.contactId } }
        : { disconnect: true };
    }
    if (dto.customerId !== undefined) {
      data.customer = dto.customerId
        ? { connect: { id: dto.customerId } }
        : { disconnect: true };
    }
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.quoteDate !== undefined) data.quoteDate = new Date(dto.quoteDate);
    if (dto.customerAddress !== undefined)
      data.customerAddress = dto.customerAddress;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.termsAndConditions !== undefined)
      data.termsAndConditions = dto.termsAndConditions;
    if (dto.templateKey !== undefined) data.templateKey = dto.templateKey;
    if (dto.validTill !== undefined) data.validTill = new Date(dto.validTill);

    if (dto.items !== undefined) {
      const subtotal = dto.items.reduce(
        (sum, item) =>
          sum + item.quantity * item.price - (item.discountAmount ?? 0),
        0,
      );
      const taxAmount =
        dto.taxAmount ??
        dto.items.reduce(
          (sum, item) =>
            sum +
            (Math.max(
              0,
              item.quantity * item.price - (item.discountAmount ?? 0),
            ) *
              (item.taxRate ?? 0)) /
              100,
          0,
        );
      data.subtotal = subtotal;
      data.discountAmount = dto.discountAmount ?? 0;
      data.taxAmount = taxAmount;
      data.adjustmentAmount = dto.adjustmentAmount ?? 0;
      data.total =
        subtotal -
        (dto.discountAmount ?? 0) +
        taxAmount +
        (dto.adjustmentAmount ?? 0);
      data.items = {
        deleteMany: {},
        create: dto.items.map((item) => ({
          name: item.name,
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          discountAmount: item.discountAmount ?? 0,
          taxRate: item.taxRate,
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
      include: { contact: true, customer: true },
    });
    if (!quote) throw new NotFoundException(`Quote #${id} not found`);

    const invoiceNo = `INV-Q${id}-${Date.now()}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId,
        invoiceNo,
        customer:
          quote.customer?.customerName ??
          quote.contact?.contactName ??
          'Quote customer',
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
