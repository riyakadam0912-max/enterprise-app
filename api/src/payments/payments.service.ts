import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import type { AuthUser } from '../common/types/auth';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(dto: CreatePaymentDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return await this.prisma.payment.create({
      data: {
        organizationId,
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        transactionId: dto.transactionId,
        paymentDate: new Date(dto.paymentDate),
        status: dto.status,
      },
      include: { invoice: true },
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return await this.prisma.payment.findMany({
      where: { organizationId },
      include: { invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByInvoice(invoiceId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const payments = await this.prisma.payment.findMany({
      where: { invoiceId, organizationId },
      orderBy: { createdAt: 'desc' },
    });
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId, organizationId },
    });
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);
    return {
      payments,
      totalAmount: invoice?.totalAmount ?? 0,
      paidAmount: paid,
      remainingAmount: (invoice?.totalAmount ?? 0) - paid,
    };
  }

  async update(id: number, dto: Partial<CreatePaymentDto>, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const existing = await this.prisma.payment.findUnique({
      where: { id },
      include: { invoice: true },
    });

    if (!existing || existing.organizationId !== organizationId) {
      throw new ForbiddenException('Payment not found');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        ...(dto.invoiceId !== undefined && { invoiceId: dto.invoiceId }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.paymentMethod !== undefined && {
          paymentMethod: dto.paymentMethod,
        }),
        ...(dto.transactionId !== undefined && {
          transactionId: dto.transactionId,
        }),
        ...(dto.paymentDate !== undefined && {
          paymentDate: new Date(dto.paymentDate),
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { invoice: true },
    });

    return updated;
  }
}
