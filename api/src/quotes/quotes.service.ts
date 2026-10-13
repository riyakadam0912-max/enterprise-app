import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import type { AuthUser } from '../common/types/auth';
import { Role } from '../common/enums/role.enum';
import {
  buildQuotePdfBuffer,
  QUOTE_TEMPLATE_KEYS,
  type QuoteTemplateKey,
} from './quote-pdf.utils';
import {
  createPublicQuoteToken,
  publicQuoteExpiry,
  publicQuoteUrl,
} from './quote-public-token.utils';
import { MailService } from '../mail/mail.service';
import { calculateQuoteTotals } from './quote-calculations';
import { OrganizationScopeService } from '../organizations/organization-scope.service';

const includeRelations = {
  deal: { select: { id: true, title: true, value: true, stage: true } },
  contact: {
    select: { id: true, contactName: true, email: true, company: true },
  },
  customer: true,
  items: true,
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationScope?: OrganizationScopeService,
    @Optional() private readonly mailService?: MailService,
  ) {}

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
      const relatedOrganizationIds = this.organizationScope
        ? await this.organizationScope.getRelatedOrganizationIds(organizationId)
        : [organizationId];
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: dto.customerId,
          organizationId: { in: relatedOrganizationIds },
          deletedAt: null,
        },
      });
      if (!customer)
        throw new NotFoundException(`Customer #${dto.customerId} not found`);
    }
    for (const item of dto.items) {
      if (item.productId) {
        const product = await this.prisma.product.findFirst({
          where: { id: item.productId, organizationId, isActive: true },
        });
        if (!product)
          throw new NotFoundException(`Product #${item.productId} not found`);
      }
    }

    const totals = calculateQuoteTotals(dto.items, {
      discountAmount: dto.discountAmount,
      discountRate: dto.discountRate,
      discountType: dto.discountType,
      adjustmentAmount: dto.adjustmentAmount,
      adjustmentRate: dto.adjustmentRate,
      adjustmentType: dto.adjustmentType,
      tdsEnabled: dto.tdsEnabled,
      tdsRate: dto.tdsRate,
      tcsEnabled: dto.tcsEnabled,
      tcsRate: dto.tcsRate,
      explicitTaxAmount: dto.taxAmount,
    });

    const quote = await this.prisma.quote.create({
      data: {
        organizationId,
        dealId: dto.dealId,
        contactId: dto.contactId,
        customerId: dto.customerId,
        name: dto.name,
        quoteDate: dto.quoteDate ? new Date(dto.quoteDate) : undefined,
        customerAddress: dto.customerAddress,
        total: totals.total,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        adjustmentAmount: totals.adjustmentAmount,
        discountType: dto.discountType ?? 'AMOUNT',
        discountRate: dto.discountRate ?? 0,
        adjustmentType: dto.adjustmentType ?? 'AMOUNT',
        adjustmentRate: dto.adjustmentRate ?? 0,
        tdsEnabled: dto.tdsEnabled ?? false,
        tdsRate: dto.tdsRate ?? 0,
        tdsAmount: totals.tdsAmount,
        tcsEnabled: dto.tcsEnabled ?? false,
        tcsRate: dto.tcsRate ?? 0,
        tcsAmount: totals.tcsAmount,
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
            unit: item.unit,
            type: item.type,
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
    await this.prisma.quoteStatusHistory.create({
      data: { quoteId: quote.id, status: quote.status, source: 'SYSTEM' },
    });
    return quote;
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
      if (dto.customerId) {
        const relatedOrganizationIds = this.organizationScope
          ? await this.organizationScope.getRelatedOrganizationIds(
              organizationId,
            )
          : [organizationId];
        const customer = await this.prisma.customer.findFirst({
          where: {
            id: dto.customerId,
            organizationId: { in: relatedOrganizationIds },
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!customer) {
          throw new NotFoundException(`Customer #${dto.customerId} not found`);
        }
        data.customer = { connect: { id: customer.id } };
      } else {
        data.customer = { disconnect: true };
      }
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
      for (const item of dto.items) {
        if (item.productId) {
          const product = await this.prisma.product.findFirst({
            where: { id: item.productId, organizationId, isActive: true },
          });
          if (!product)
            throw new NotFoundException(`Product #${item.productId} not found`);
        }
      }
      const totals = calculateQuoteTotals(dto.items, {
        discountAmount: dto.discountAmount,
        discountRate: dto.discountRate,
        discountType: dto.discountType,
        adjustmentAmount: dto.adjustmentAmount,
        adjustmentRate: dto.adjustmentRate,
        adjustmentType: dto.adjustmentType,
        tdsEnabled: dto.tdsEnabled,
        tdsRate: dto.tdsRate,
        tcsEnabled: dto.tcsEnabled,
        tcsRate: dto.tcsRate,
        explicitTaxAmount: dto.taxAmount,
      });
      data.subtotal = totals.subtotal;
      data.discountAmount = totals.discountAmount;
      data.taxAmount = totals.taxAmount;
      data.adjustmentAmount = totals.adjustmentAmount;
      data.total = totals.total;
      data.discountType = dto.discountType ?? 'AMOUNT';
      data.discountRate = dto.discountRate ?? 0;
      data.adjustmentType = dto.adjustmentType ?? 'AMOUNT';
      data.adjustmentRate = dto.adjustmentRate ?? 0;
      data.tdsEnabled = dto.tdsEnabled ?? false;
      data.tdsRate = dto.tdsRate ?? 0;
      data.tdsAmount = totals.tdsAmount;
      data.tcsEnabled = dto.tcsEnabled ?? false;
      data.tcsRate = dto.tcsRate ?? 0;
      data.tcsAmount = totals.tcsAmount;
      data.items = {
        deleteMany: {},
        create: dto.items.map((item) => ({
          name: item.name,
          productId: item.productId,
          description: item.description,
          unit: item.unit,
          type: item.type,
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

    const existing = await this.prisma.quote.findUnique({
      where: { id, organizationId },
      select: { status: true },
    });
    const updated = await this.prisma.quote.update({
      where: { id, organizationId },
      data,
      include: includeRelations,
    });
    if (dto.status !== undefined && dto.status !== existing?.status) {
      await this.prisma.quoteStatusHistory.create({
        data: { quoteId: id, status: dto.status, source: 'DASHBOARD' },
      });
    }
    return updated;
  }

  async createPublicLink(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const quote = await this.prisma.quote.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true,
        status: true,
        validTill: true,
        customerId: true,
        total: true,
      },
    });
    if (!quote) throw new NotFoundException(`Quote #${id} not found`);
    if (!quote.customerId || quote.total < 0)
      throw new ForbiddenException('Quote is incomplete');
    if (quote.validTill <= new Date())
      throw new ForbiddenException('Quote has expired');
    if (
      quote.status === 'ACCEPTED' ||
      quote.status === 'REJECTED' ||
      quote.status === 'CONVERTED'
    ) {
      throw new ForbiddenException(
        'Quote cannot be shared in its current status',
      );
    }

    const tokenData = createPublicQuoteToken();
    const expiresAt = publicQuoteExpiry(quote.validTill);
    const result = await this.prisma.$transaction(async (transaction) => {
      const link = await transaction.quotePublicLink.upsert({
        where: { quoteId: id },
        create: { quoteId: id, tokenHash: tokenData.tokenHash, expiresAt },
        update: { tokenHash: tokenData.tokenHash, expiresAt, revokedAt: null },
      });
      if (quote.status === 'DRAFT') {
        await transaction.quote.update({
          where: { id },
          data: { status: 'SENT' },
        });
        await transaction.quoteStatusHistory.create({
          data: { quoteId: id, status: 'SENT', source: 'SHARE' },
        });
      }
      return link;
    });
    return {
      publicQuoteUrl: publicQuoteUrl(tokenData.token),
      expiresAt: result.expiresAt,
    };
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.quote.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async sendByEmail(
    id: number,
    recipient: string,
    subject: string | undefined,
    message: string | undefined,
    user: AuthUser,
  ) {
    const quote = await this.findOne(id, user);
    if (quote.validTill <= new Date()) {
      throw new ForbiddenException('Quote has expired');
    }
    const pdf = await this.generatePdf(id, user);
    if (!this.mailService) {
      throw new ForbiddenException('Email delivery is not configured');
    }
    const text = message?.trim() || `Please find quote Q-${quote.id} attached.`;
    const result = await this.mailService.sendEmail({
      to: recipient,
      subject: subject?.trim() || `Your quote Q-${quote.id}`,
      text,
      html: `<p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`,
      attachments: [
        {
          filename: `quote-${quote.id}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });
    if (!result.success) {
      throw new ForbiddenException(
        result.error || 'Quote email could not be sent',
      );
    }
    if (quote.status === 'DRAFT') {
      await this.prisma.quote.update({
        where: { id, organizationId: user.organizationId! },
        data: { status: 'SENT' },
      });
      await this.prisma.quoteStatusHistory.create({
        data: { quoteId: id, status: 'SENT', source: 'EMAIL' },
      });
    }
    return { success: true, messageId: result.messageId, recipient };
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
    await this.prisma.quoteStatusHistory.create({
      data: { quoteId: id, status: 'CONVERTED', source: 'DASHBOARD' },
    });

    return invoice;
  }

  async generatePdf(id: number, user: AuthUser) {
    const quote = await this.findOne(id, user);
    const customerName =
      quote.customer?.customerName ??
      quote.contact?.contactName ??
      'Quote customer';
    const customerAddress =
      quote.customerAddress ??
      (quote.customer
        ? [
            quote.customer.addressLine1,
            quote.customer.addressLine2,
            quote.customer.city,
            quote.customer.state,
            quote.customer.zipCode,
          ]
            .filter(Boolean)
            .join(', ')
        : null);
    const formatAmount = (amount: number) => `INR ${amount.toFixed(2)}`;
    return buildQuotePdfBuffer({
      quoteNumber: `Q-${quote.id}`,
      quoteName: quote.name,
      quoteDate: quote.quoteDate.toISOString().slice(0, 10),
      validTill: quote.validTill.toISOString().slice(0, 10),
      customer: customerName,
      customerAddress,
      companyName: 'Enterprise ERP',
      items: quote.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: Math.max(0, item.quantity * item.price - item.discountAmount),
      })),
      subtotal: formatAmount(quote.subtotal),
      discount: formatAmount(quote.discountAmount),
      tax: formatAmount(quote.taxAmount),
      adjustment: formatAmount(quote.adjustmentAmount),
      tds: quote.tdsEnabled ? formatAmount(quote.tdsAmount) : undefined,
      tcs: quote.tcsEnabled ? formatAmount(quote.tcsAmount) : undefined,
      total: formatAmount(quote.total),
      terms: quote.termsAndConditions,
      templateKey: QUOTE_TEMPLATE_KEYS.includes(
        quote.templateKey as QuoteTemplateKey,
      )
        ? (quote.templateKey as QuoteTemplateKey)
        : 'minimal',
    });
  }
}
