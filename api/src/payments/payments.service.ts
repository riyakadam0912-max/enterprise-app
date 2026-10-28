import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  private async getInvoiceForOrganization(
    invoiceId: number,
    organizationId: number,
    options: { allowClosed?: boolean } = {},
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId, organizationId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (
      !options.allowClosed &&
      ['CANCELLED', 'VOIDED'].includes(String(invoice.status).toUpperCase())
    ) {
      throw new BadRequestException('Payments cannot be recorded for this invoice');
    }
    return invoice;
  }

  private validateAmount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
  }

  private calculatePaidAmount(payments: Array<{ amount: number; status: string }>) {
    return payments.reduce((sum, payment) => {
      const status = String(payment.status ?? 'COMPLETED').toUpperCase();
      if (status === 'FAILED' || status === 'PENDING') return sum;
      if (status === 'REFUNDED') return sum - payment.amount;
      return sum + payment.amount;
    }, 0);
  }

  async create(dto: CreatePaymentDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    this.validateAmount(dto.amount);
    await this.getInvoiceForOrganization(dto.invoiceId, organizationId);
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
    const invoice = await this.getInvoiceForOrganization(invoiceId, organizationId, {
      allowClosed: true,
    });
    const payments = await this.prisma.payment.findMany({
      where: { invoiceId, organizationId },
      orderBy: { createdAt: 'desc' },
    });
    const paid = this.calculatePaidAmount(payments);
    return {
      payments,
      totalAmount: invoice.totalAmount,
      paidAmount: paid,
      remainingAmount: (invoice?.totalAmount ?? 0) - paid,
    };
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId },
      include: { invoice: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async update(id: number, dto: Partial<CreatePaymentDto>, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const existing = await this.prisma.payment.findUnique({
      where: { id },
      include: { invoice: true },
    });

    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundException('Payment not found');
    }
    if (dto.amount !== undefined) this.validateAmount(dto.amount);
    if (dto.invoiceId !== undefined && dto.invoiceId !== existing.invoiceId) {
      await this.getInvoiceForOrganization(dto.invoiceId, organizationId);
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
