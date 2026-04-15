import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

const STATUSES = ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED'] as const;

const includeRelations = {
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInvoiceDto, userId: number) {
    return this.prisma.invoice.create({
      data: {
        invoiceNo:     dto.invoiceNo,
        issueDate:     dto.issueDate     ? new Date(dto.issueDate)  : undefined,
        dueDate:       dto.dueDate       ? new Date(dto.dueDate)    : undefined,
        status:        dto.status        ?? 'DRAFT',
        customer:      dto.customer,
        totalAmount:   dto.totalAmount   ?? 0,
        taxAmount:     dto.taxAmount     ?? 0,
        discount:      dto.discount      ?? 0,
        paymentMethod: dto.paymentMethod,
        notes:         dto.notes,
        userId,
      },
      include: includeRelations,
    });
  }

  async findAll() {
    return this.prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: includeRelations,
    });
  }

  async findOne(id: number) {
    const inv = await this.prisma.invoice.findUnique({
      where:   { id },
      include: includeRelations,
    });
    if (!inv) throw new NotFoundException(`Invoice #${id} not found`);
    return inv;
  }

  async update(id: number, dto: UpdateInvoiceDto) {
    await this.findOne(id);
    const data: Prisma.InvoiceUpdateInput = {};
    if (dto.invoiceNo     !== undefined) data.invoiceNo     = dto.invoiceNo;
    if (dto.issueDate     !== undefined) data.issueDate     = dto.issueDate ? new Date(dto.issueDate) : null;
    if (dto.dueDate       !== undefined) data.dueDate       = dto.dueDate   ? new Date(dto.dueDate)   : null;
    if (dto.status        !== undefined) data.status        = dto.status;
    if (dto.customer      !== undefined) data.customer      = dto.customer;
    if (dto.totalAmount   !== undefined) data.totalAmount   = dto.totalAmount;
    if (dto.taxAmount     !== undefined) data.taxAmount     = dto.taxAmount;
    if (dto.discount      !== undefined) data.discount      = dto.discount;
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod;
    if (dto.notes         !== undefined) data.notes         = dto.notes;

    return this.prisma.invoice.update({
      where:   { id },
      data,
      include: includeRelations,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async importRecords(records: Record<string, any>[], userId: number): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.invoiceNo) { errors.push(`Row ${i + 1}: 'invoiceNo' is required`); continue; }
      try {
        await this.prisma.invoice.create({
          data: {
            invoiceNo:     String(r.invoiceNo),
            issueDate:     r.issueDate     ? new Date(String(r.issueDate))  : undefined,
            dueDate:       r.dueDate       ? new Date(String(r.dueDate))    : undefined,
            status:        r.status        ? String(r.status)        : 'DRAFT',
            customer:      r.customer      ? String(r.customer)      : undefined,
            totalAmount:   r.totalAmount   ? Number(r.totalAmount)   : 0,
            taxAmount:     r.taxAmount     ? Number(r.taxAmount)     : 0,
            discount:      r.discount      ? Number(r.discount)      : 0,
            paymentMethod: r.paymentMethod ? String(r.paymentMethod) : undefined,
            notes:         r.notes         ? String(r.notes)         : undefined,
            userId,
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
    const invoices = await this.prisma.invoice.findMany({
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
    });
    const grouped = Object.fromEntries(STATUSES.map((s) => [s, []])) as Record<string, typeof invoices>;
    for (const inv of invoices) {
      const key = inv.status.toUpperCase();
      if (key in grouped) grouped[key].push(inv);
    }
    return grouped;
  }
}
