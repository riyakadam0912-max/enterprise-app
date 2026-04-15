import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma;
  }

  async create(dto: CreatePaymentDto) {
    return this.db.payment.create({
      data: {
        invoiceId:     dto.invoiceId,
        amount:        dto.amount,
        paymentMethod: dto.paymentMethod,
        transactionId: dto.transactionId,
        paymentDate:   new Date(dto.paymentDate),
        status:        dto.status,
      },
      include: { invoice: true },
    });
  }

  async findAll() {
    return this.db.payment.findMany({
      include: { invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByInvoice(invoiceId: number) {
    const payments = await this.db.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    });
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);
    return {
      payments,
      totalAmount:     invoice?.totalAmount ?? 0,
      paidAmount:      paid,
      remainingAmount: (invoice?.totalAmount ?? 0) - paid,
    };
  }
}
