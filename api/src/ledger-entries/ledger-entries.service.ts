import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';
import { AuthUser } from '../common/types/auth';

const includeRelations: Prisma.LedgerEntryInclude = {
  user: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class LedgerEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(dto: CreateLedgerEntryDto, userId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.ledgerEntry.create({
      data: {
        organizationId,
        date: dto.date ? new Date(dto.date) : undefined,
        description: dto.description,
        debit: dto.debit ?? 0,
        credit: dto.credit ?? 0,
        account: dto.account,
        invoice: dto.invoice,
        expense: dto.expense,
        balance: dto.balance ?? 0,
        reference: dto.reference,
        userId,
      },
      include: includeRelations,
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.ledgerEntry.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: includeRelations,
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const entry = await this.prisma.ledgerEntry.findUnique({
      where: { id, organizationId },
      include: includeRelations,
    });
    if (!entry) throw new NotFoundException(`LedgerEntry #${id} not found`);
    return entry;
  }

  async update(id: number, dto: UpdateLedgerEntryDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.ledgerEntry.update({
      where: { id, organizationId },
      data: {
        ...(dto.date !== undefined && {
          date: dto.date ? new Date(dto.date) : null,
        }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.debit !== undefined && { debit: dto.debit }),
        ...(dto.credit !== undefined && { credit: dto.credit }),
        ...(dto.account !== undefined && { account: dto.account }),
        ...(dto.invoice !== undefined && { invoice: dto.invoice }),
        ...(dto.expense !== undefined && { expense: dto.expense }),
        ...(dto.balance !== undefined && { balance: dto.balance }),
        ...(dto.reference !== undefined && { reference: dto.reference }),
      },
      include: includeRelations,
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.ledgerEntry.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async importRecords(
    records: Array<Record<string, unknown>>,
    userId: number,
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    const organizationId = this.validateOrganization(user);
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      try {
        const data: Prisma.LedgerEntryCreateInput = {
          organization: { connect: { id: organizationId } },
          date:
            typeof r.date === 'string' || r.date instanceof Date
              ? new Date(String(r.date))
              : undefined,
          description:
            typeof r.description === 'string' ? r.description : undefined,
          debit:
            typeof r.debit === 'number'
              ? r.debit
              : typeof r.debit === 'string'
                ? Number(r.debit)
                : 0,
          credit:
            typeof r.credit === 'number'
              ? r.credit
              : typeof r.credit === 'string'
                ? Number(r.credit)
                : 0,
          account: typeof r.account === 'string' ? r.account : undefined,
          invoice: typeof r.invoice === 'string' ? r.invoice : undefined,
          expense: typeof r.expense === 'string' ? r.expense : undefined,
          balance:
            typeof r.balance === 'number'
              ? r.balance
              : typeof r.balance === 'string'
                ? Number(r.balance)
                : 0,
          reference: typeof r.reference === 'string' ? r.reference : undefined,
          user: { connect: { id: userId } },
        };

        await this.prisma.ledgerEntry.create({
          data,
        });
        imported++;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${message}`);
      }
    }
    return { imported, errors };
  }
}
