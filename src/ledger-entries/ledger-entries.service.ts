import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';

const includeRelations = {
  user: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class LedgerEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLedgerEntryDto, userId: number) {
    return this.prisma.ledgerEntry.create({
      data: {
        date:        dto.date        ? new Date(dto.date) : undefined,
        description: dto.description,
        debit:       dto.debit       ?? 0,
        credit:      dto.credit      ?? 0,
        account:     dto.account,
        invoice:     dto.invoice,
        expense:     dto.expense,
        balance:     dto.balance     ?? 0,
        reference:   dto.reference,
        userId,
      },
      include: includeRelations,
    });
  }

  async findAll() {
    return this.prisma.ledgerEntry.findMany({
      orderBy: { createdAt: 'desc' },
      include: includeRelations,
    });
  }

  async findOne(id: number) {
    const entry = await this.prisma.ledgerEntry.findUnique({
      where:   { id },
      include: includeRelations,
    });
    if (!entry) throw new NotFoundException(`LedgerEntry #${id} not found`);
    return entry;
  }

  async update(id: number, dto: UpdateLedgerEntryDto) {
    await this.findOne(id);
    return this.prisma.ledgerEntry.update({
      where: { id },
      data: {
        ...(dto.date        !== undefined && { date:        dto.date ? new Date(dto.date) : null }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.debit       !== undefined && { debit:       dto.debit }),
        ...(dto.credit      !== undefined && { credit:      dto.credit }),
        ...(dto.account     !== undefined && { account:     dto.account }),
        ...(dto.invoice     !== undefined && { invoice:     dto.invoice }),
        ...(dto.expense     !== undefined && { expense:     dto.expense }),
        ...(dto.balance     !== undefined && { balance:     dto.balance }),
        ...(dto.reference   !== undefined && { reference:   dto.reference }),
      },
      include: includeRelations,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.ledgerEntry.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async importRecords(records: Record<string, any>[], userId: number): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      try {
        await this.prisma.ledgerEntry.create({
          data: {
            date:        r.date        ? new Date(String(r.date)) : undefined,
            description: r.description ? String(r.description) : undefined,
            debit:       r.debit       ? Number(r.debit)   : 0,
            credit:      r.credit      ? Number(r.credit)  : 0,
            account:     r.account     ? String(r.account) : undefined,
            invoice:     r.invoice     ? String(r.invoice) : undefined,
            expense:     r.expense     ? String(r.expense) : undefined,
            balance:     r.balance     ? Number(r.balance) : 0,
            reference:   r.reference   ? String(r.reference) : undefined,
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
}
