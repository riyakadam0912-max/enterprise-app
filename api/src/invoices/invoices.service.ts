import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { MailService } from '../mail/mail.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { renderInvoiceLetter } from './invoice-email.utils';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { AuthUser } from '../common/types/auth';

const STATUSES = [
  'DRAFT',
  'SENT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
  'REFUNDED',
  'VOIDED',
] as const;

const includeRelations = {
  user: { select: { id: true, name: true, email: true } },
  payments: {
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.InvoiceInclude;

function parseNotes(notes?: string | null) {
  const text = notes?.trim() ?? '';
  if (!text) return { clientEmail: '', body: '' };

  const lines = text.split(/\r?\n/);
  const body: string[] = [];
  let clientEmail = '';

  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized) {
      body.push('');
      continue;
    }
    if (normalized.toLowerCase().startsWith('client email:')) {
      clientEmail = normalized.slice('client email:'.length).trim();
      continue;
    }
    body.push(line);
  }

  const result = { clientEmail, body: body.join('\n').trim() };
  return result;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly auditLogsService: AuditLogsService,
    private readonly configService: ConfigService,
  ) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new BadRequestException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(dto: CreateInvoiceDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.invoice.create({
      data: {
        organization: { connect: { id: organizationId } },
        invoiceNo: dto.invoiceNo,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status ?? 'DRAFT',
        customer: dto.customer,
        clientEmail: dto.clientEmail,
        totalAmount: dto.totalAmount ?? 0,
        taxAmount: dto.taxAmount ?? 0,
        discount: dto.discount ?? 0,
        paymentMethod: dto.paymentMethod,
        notes: dto.notes,
        user: { connect: { id: user.userId } },
      },
      include: includeRelations,
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.invoice.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: includeRelations,
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const inv = await this.prisma.invoice.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: includeRelations,
    });
    if (!inv) throw new NotFoundException(`Invoice #${id} not found`);
    return inv;
  }

  async update(id: number, dto: UpdateInvoiceDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    const data: Prisma.InvoiceUpdateInput = {};
    if (dto.invoiceNo !== undefined) data.invoiceNo = dto.invoiceNo;
    if (dto.issueDate !== undefined)
      data.issueDate = dto.issueDate ? new Date(dto.issueDate) : null;
    if (dto.dueDate !== undefined)
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.customer !== undefined) data.customer = dto.customer;
    if (dto.clientEmail !== undefined) data.clientEmail = dto.clientEmail;
    if (dto.totalAmount !== undefined) data.totalAmount = dto.totalAmount;
    if (dto.taxAmount !== undefined) data.taxAmount = dto.taxAmount;
    if (dto.discount !== undefined) data.discount = dto.discount;
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.invoice.update({
      where: { id, organizationId },
      data,
      include: includeRelations,
    });
  }

  async sendInvoice(id: number, dto: SendInvoiceDto = {}, user: AuthUser) {
    this.logger.log('[sendInvoice] Called with invoice id:', id);
    const organizationId = this.validateOrganization(user);
    const invoice = await this.findOne(id, user);
    const parsedNotes = parseNotes(invoice.notes);
    const recipientEmail = String(
      dto.to ?? invoice?.clientEmail ?? parsedNotes.clientEmail ?? '',
    ).trim();
    const defaultSenderEmail =
      this.configService.get<string>('SMTP_FROM_EMAIL');
    const senderEmail = String(
      dto.senderEmail ?? defaultSenderEmail ?? '',
    ).trim();
    const subject = dto.subject?.trim() || `Invoice ${invoice.invoiceNo}`;

    this.logger.log('[sendInvoice] Recipient email:', recipientEmail);
    this.logger.log('[sendInvoice] Sender email:', senderEmail);
    this.logger.log('[sendInvoice] Subject:', subject);

    if (!recipientEmail) {
      this.logger.error('[sendInvoice] Missing recipient email');
      throw new BadRequestException(
        'Invoice client email is missing. Add a client email before sending.',
      );
    }

    if (!senderEmail) {
      this.logger.error('[sendInvoice] Missing sender email');
      throw new BadRequestException(
        'Please enter a sender email address before sending.',
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(senderEmail)) {
      this.logger.error('[sendInvoice] Invalid sender email:', senderEmail);
      throw new BadRequestException(
        'The sender email address is invalid. Enter a valid email address before sending.',
      );
    }

    const providerType = (
      this.configService.get<string>('EMAIL_PROVIDER') || ''
    ).toLowerCase();
    const authorizedSenders = [
      'sendgrid',
      'ses',
      'resend',
      'nodemailer',
    ].includes(providerType)
      ? this.configService.get<string>('EMAIL_ALLOWED_SENDER_EMAILS') || ''
      : '';
    const normalizedAuthorizedSenders = authorizedSenders
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    const defaultFrom = [
      this.configService.get<string>('SMTP_FROM_EMAIL'),
      this.configService.get<string>('SENDGRID_FROM_EMAIL'),
      this.configService.get<string>('RESEND_FROM_EMAIL'),
      this.configService.get<string>('AWS_SES_FROM_EMAIL'),
    ]
      .map((value) => value?.trim().toLowerCase())
      .filter(Boolean);

    const senderIsAuthorized =
      normalizedAuthorizedSenders.length > 0
        ? normalizedAuthorizedSenders.includes(senderEmail.toLowerCase())
        : defaultFrom.includes(senderEmail.toLowerCase());

    if (!senderIsAuthorized) {
      this.logger.error(
        '[sendInvoice] Sender email not authorized:',
        senderEmail,
      );
      throw new BadRequestException(
        `The sender email address ${senderEmail} is not configured for the active email provider. Use an authorized sender address before sending.`,
      );
    }

    if (!subject) {
      this.logger.error('[sendInvoice] Missing subject');
      throw new BadRequestException(
        'Please enter a subject line before sending.',
      );
    }

    this.logger.log(
      '[sendInvoice] Preparing invoice email',
      invoice.invoiceNo,
      'for',
      recipientEmail,
    );

    const issueDateText = invoice.issueDate
      ? new Date(invoice.issueDate).toLocaleDateString('en-GB')
      : '—';
    const dueDateText = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString('en-GB')
      : '—';
    const totalAmountText = `₹${Number(invoice.totalAmount ?? 0).toLocaleString('en-IN')}`;
    const invoiceUser = invoice.user as { name?: unknown } | null | undefined;
    const senderName =
      typeof invoiceUser?.name === 'string'
        ? invoiceUser.name
        : 'Accounts Team';
    const defaultLetter = [
      'Dear {{CustomerName}},',
      '',
      'We hope you are doing well.',
      '',
      'Please find attached Invoice {{InvoiceNumber}} for the services/products provided.',
      'The invoice amount is {{TotalAmount}}.',
      'Kindly make payment before {{DueDate}}.',
      '',
      'If you have any questions, please feel free to contact us.',
      '',
      'Thank you for your business.',
      '',
      'Kind Regards,',
      '',
      '{{CompanyName}}',
    ].join('\n');
    const messageBody = renderInvoiceLetter(
      dto.message?.trim() || defaultLetter,
      {
        CustomerName: invoice.customer ?? 'Valued Customer',
        InvoiceNumber: invoice.invoiceNo,
        TotalAmount: totalAmountText,
        DueDate: dueDateText,
        CompanyName: dto.companyName?.trim() || 'Northstar Labs',
      },
    );

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <div style="max-width: 760px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
            <div>
              <div style="font-size: 24px; font-weight: 700; color: #0f172a;">${dto.companyName?.trim() || 'Northstar Labs'}</div>
              <div style="font-size: 13px; color: #475569; margin-top: 4px;">Professional Invoicing • Accounts Receivable</div>
            </div>
            <div style="text-align: right; font-size: 13px; color: #475569;">
              <div><strong>Invoice</strong> ${invoice.invoiceNo}</div>
              <div>Issue Date: ${issueDateText}</div>
              <div>Due Date: ${dueDateText}</div>
            </div>
          </div>
          <div style="white-space: pre-wrap; font-size: 15px;">${messageBody.replace(/\n/g, '<br />')}</div>
          <div style="margin-top: 24px; padding: 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0;">
            <div style="font-size: 14px; font-weight: 600; color: #0f172a;">Invoice Summary</div>
            <div style="margin-top: 8px; font-size: 14px; color: #475569;">Customer: ${invoice.customer ?? 'Valued Customer'}</div>
            <div style="font-size: 14px; color: #475569;">Total Amount: ${totalAmountText}</div>
            <div style="font-size: 14px; color: #475569;">Payment Terms: ${invoice.paymentMethod ?? 'Net 15 days'}</div>
          </div>
          <div style="margin-top: 24px; font-size: 13px; color: #64748b;">Regards,<br />${senderName}</div>
        </div>
      </div>
    `;

    const attachments = [
      {
        filename: `${invoice.invoiceNo}.pdf`,
        content: Buffer.from(
          `Invoice ${invoice.invoiceNo}\nCustomer: ${invoice.customer ?? 'Valued Customer'}\nAmount: ${totalAmountText}`,
        ),
        contentType: 'application/pdf',
      },
    ];

    try {
      this.logger.log('[sendInvoice] Calling MailService.sendEmail');
      const result = await this.mailService.sendEmail({
        to: recipientEmail,
        from: senderEmail,
        cc: (dto.cc ?? []).filter(Boolean),
        bcc: (dto.bcc ?? []).filter(Boolean),
        subject,
        html,
        text: messageBody,
        attachments,
        metadata: {
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          recipient: recipientEmail,
          senderEmail,
          attachmentTypes: dto.attachmentTypes ?? ['invoice-pdf'],
        },
        tags: ['invoice', 'transactional'],
      });

      this.logger.log('[sendInvoice] MailService result:', result);

      if (!result.success) {
        this.logger.error(
          '[sendInvoice] Invoice email failed',
          invoice.invoiceNo,
          recipientEmail,
          result.error,
        );
        await this.auditLogsService.logCustomAction({
          userId: user.userId,
          module: 'Accounting',
          entityType: 'Invoice',
          entityId: invoice.id,
          action: 'INVOICE_EMAIL_FAILED',
          description: `Invoice email failed for ${invoice.invoiceNo}`,
          status: 'FAILURE',
        });
        throw new BadRequestException(
          result.error ?? 'Failed to send invoice email',
        );
      }

      await this.prisma.invoice.update({
        where: { id, organizationId },
        data: { status: 'SENT' },
      });

      await this.auditLogsService.logCustomAction({
        userId: user.userId,
        module: 'Accounting',
        entityType: 'Invoice',
        entityId: invoice.id,
        action: 'INVOICE_EMAIL_SENT',
        description: `Invoice ${invoice.invoiceNo} was sent to ${recipientEmail}`,
        status: 'SUCCESS',
      });

      this.logger.log('[sendInvoice] Invoice sent successfully');
      return {
        success: true,
        message: 'Invoice emailed successfully',
      };
    } catch (error) {
      this.logger.error(
        '[sendInvoice] Exception sending invoice email',
        invoice.invoiceNo,
        error,
      );
      throw error;
    }
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.invoice.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async importRecords(
    records: Array<Record<string, unknown>>,
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    const organizationId = this.validateOrganization(user);
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const invoiceNo = typeof r.invoiceNo === 'string' ? r.invoiceNo : '';
      if (!invoiceNo) {
        errors.push(`Row ${i + 1}: 'invoiceNo' is required`);
        continue;
      }
      try {
        const data: Prisma.InvoiceCreateInput = {
          organization: { connect: { id: organizationId } },
          invoiceNo,
          issueDate:
            typeof r.issueDate === 'string' || r.issueDate instanceof Date
              ? new Date(String(r.issueDate))
              : undefined,
          dueDate:
            typeof r.dueDate === 'string' || r.dueDate instanceof Date
              ? new Date(String(r.dueDate))
              : undefined,
          status: typeof r.status === 'string' ? r.status : 'DRAFT',
          customer: typeof r.customer === 'string' ? r.customer : undefined,
          totalAmount:
            typeof r.totalAmount === 'number'
              ? r.totalAmount
              : typeof r.totalAmount === 'string'
                ? Number(r.totalAmount)
                : 0,
          taxAmount:
            typeof r.taxAmount === 'number'
              ? r.taxAmount
              : typeof r.taxAmount === 'string'
                ? Number(r.taxAmount)
                : 0,
          discount:
            typeof r.discount === 'number'
              ? r.discount
              : typeof r.discount === 'string'
                ? Number(r.discount)
                : 0,
          paymentMethod:
            typeof r.paymentMethod === 'string' ? r.paymentMethod : undefined,
          notes: typeof r.notes === 'string' ? r.notes : undefined,
          user: { connect: { id: user.userId } },
        };

        await this.prisma.invoice.create({
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

  async getByStatus(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId, deletedAt: null },
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
    });
    const grouped = Object.fromEntries(
      STATUSES.map((status) => [status, []]),
    ) as Record<
      string,
      Array<
        Prisma.InvoiceGetPayload<{
          include: typeof includeRelations;
        }>
      >
    >;
    for (const inv of invoices) {
      const key = inv.status.toUpperCase();
      if (key in grouped) grouped[key].push(inv);
    }
    return grouped;
  }
}
