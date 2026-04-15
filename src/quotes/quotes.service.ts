import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

const includeRelations = {
  deal: { select: { id: true, title: true, value: true, stage: true } },
  contact: { select: { id: true, contactName: true, email: true, company: true } },
  items: true,
};

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  async create(dto: CreateQuoteDto) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dto.dealId } });
    if (!deal) throw new NotFoundException(`Deal #${dto.dealId} not found`);

    const contact = await this.prisma.contact.findUnique({ where: { id: dto.contactId } });
    if (!contact) throw new NotFoundException(`Contact #${dto.contactId} not found`);

    const total = dto.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    return this.db.quote.create({
      data: {
        dealId:    dto.dealId,
        contactId: dto.contactId,
        total,
        status:    dto.status ?? 'DRAFT',
        validTill: new Date(dto.validTill),
        notes:     dto.notes,
        items: {
          create: dto.items.map((item) => ({
            name:     item.name,
            quantity: item.quantity,
            price:    item.price,
          })),
        },
      },
      include: includeRelations,
    });
  }

  async findAll() {
    return this.db.quote.findMany({
      orderBy: { createdAt: 'desc' },
      include: includeRelations,
    });
  }

  async findOne(id: number) {
    const quote = await this.db.quote.findUnique({
      where:   { id },
      include: includeRelations,
    });
    if (!quote) throw new NotFoundException(`Quote #${id} not found`);
    return quote;
  }

  async update(id: number, dto: UpdateQuoteDto) {
    await this.findOne(id);

    const data: Record<string, any> = {};
    if (dto.dealId    !== undefined) data.dealId    = dto.dealId;
    if (dto.contactId !== undefined) data.contactId = dto.contactId;
    if (dto.status    !== undefined) data.status    = dto.status;
    if (dto.notes     !== undefined) data.notes     = dto.notes;
    if (dto.validTill !== undefined) data.validTill = new Date(dto.validTill);

    if (dto.items !== undefined) {
      data.total = dto.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      data.items = {
        deleteMany: {},
        create: dto.items.map((item) => ({
          name:     item.name,
          quantity: item.quantity,
          price:    item.price,
        })),
      };
    }

    return this.db.quote.update({
      where:   { id },
      data,
      include: includeRelations,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.db.quote.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async convertToInvoice(id: number, userId: number) {
    const quote = await this.db.quote.findUnique({
      where:   { id },
      include: { contact: true },
    });
    if (!quote) throw new NotFoundException(`Quote #${id} not found`);

    const invoiceNo = `INV-Q${id}-${Date.now()}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNo,
        customer:    quote.contact.contactName,
        totalAmount: quote.total,
        status:      'DRAFT',
        issueDate:   new Date(),
        dueDate:     quote.validTill,
        notes:       quote.notes ?? undefined,
        userId,
      },
    });

    // Mark quote as accepted after invoice is created
    await this.db.quote.update({
      where: { id },
      data:  { status: 'ACCEPTED' },
    });

    return invoice;
  }
}
