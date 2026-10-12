import {
  Injectable,
  NotFoundException,
  GoneException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashPublicQuoteToken } from './quote-public-token.utils';

const publicQuoteInclude = {
  customer: true,
  items: true,
  organization: { select: { name: true, logoUrl: true, currency: true } },
  publicLink: true,
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class PublicQuotesService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolve(token: string) {
    const link = await this.prisma.quotePublicLink.findUnique({
      where: { tokenHash: hashPublicQuoteToken(token) },
      include: { quote: { include: publicQuoteInclude } },
    });
    if (!link || link.revokedAt)
      throw new NotFoundException('Public quote link not found');
    if (link.expiresAt <= new Date()) {
      if (link.quote.status === 'SENT') {
        await this.prisma.$transaction([
          this.prisma.quote.update({
            where: { id: link.quote.id },
            data: { status: 'EXPIRED' },
          }),
          this.prisma.quoteStatusHistory.create({
            data: {
              quoteId: link.quote.id,
              status: 'EXPIRED',
              source: 'SYSTEM',
            },
          }),
        ]);
      }
      throw new GoneException('This quote link has expired');
    }
    if (link.quote.deletedAt) throw new NotFoundException('Quote not found');
    return link;
  }

  async findOne(token: string) {
    const link = await this.resolve(token);
    await this.prisma.quotePublicLink.update({
      where: { id: link.id },
      data: { lastAccessedAt: new Date() },
    });
    const quote = link.quote;
    return {
      id: quote.id,
      quoteNumber: `Q-${quote.id}`,
      name: quote.name,
      quoteDate: quote.quoteDate,
      validTill: quote.validTill,
      customerAddress: quote.customerAddress,
      total: quote.total,
      subtotal: quote.subtotal,
      discountAmount: quote.discountAmount,
      taxAmount: quote.taxAmount,
      adjustmentAmount: quote.adjustmentAmount,
      tdsEnabled: quote.tdsEnabled,
      tdsRate: quote.tdsRate,
      tdsAmount: quote.tdsAmount,
      tcsEnabled: quote.tcsEnabled,
      tcsRate: quote.tcsRate,
      tcsAmount: quote.tcsAmount,
      status: quote.status,
      notes: null,
      termsAndConditions: quote.termsAndConditions,
      customer: quote.customer
        ? {
            customerName: quote.customer.customerName,
            email: quote.customer.email,
            phoneNumber: quote.customer.phoneNumber,
            address: [
              quote.customer.addressLine1,
              quote.customer.addressLine2,
              quote.customer.city,
              quote.customer.state,
              quote.customer.zipCode,
            ]
              .filter(Boolean)
              .join(', '),
          }
        : null,
      items: quote.items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        discountAmount: item.discountAmount,
        taxRate: item.taxRate,
      })),
      company: quote.organization,
      statusHistory: quote.statusHistory.map((entry) => ({
        status: entry.status,
        source: entry.source,
        comment: entry.comment,
        createdAt: entry.createdAt,
      })),
      linkExpiresAt: link.expiresAt,
    };
  }

  async decide(
    token: string,
    status: 'ACCEPTED' | 'REJECTED',
    comment?: string,
  ) {
    const link = await this.resolve(token);
    const quote = link.quote;
    if (quote.status !== 'SENT') {
      if (quote.status === status) return this.findOne(token);
      throw new ConflictException(
        `Quote cannot be ${status.toLowerCase()} from ${quote.status.toLowerCase()}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.quote.update({ where: { id: quote.id }, data: { status } }),
      this.prisma.quoteStatusHistory.create({
        data: {
          quoteId: quote.id,
          status,
          source: 'PUBLIC_LINK',
          comment: comment?.trim() || undefined,
        },
      }),
    ]);
    return this.findOne(token);
  }
}
