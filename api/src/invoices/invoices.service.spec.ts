import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ConfigService } from '@nestjs/config';
import {
  createMockPrismaService,
  createMockMailService,
  createMockAuditLogsService,
  createMockConfigService,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto as _UpdateInvoiceDto } from './dto/update-invoice.dto';
import { SendInvoiceDto as _SendInvoiceDto } from './dto/send-invoice.dto';

function createMockAuthUser(
  role: Role,
  overrides: Partial<AuthUser> = {},
): AuthUser {
  return {
    id: 1,
    userId: 1,
    email: 'test@example.com',
    name: 'Test User',
    role,
    roles: [role],
    permissions: [],
    employeeId: null,
    organizationId: 1,
    tokenType: 'Bearer',
    jti: null,
    ...overrides,
  };
}

function createInvoiceDto(
  overrides: Partial<CreateInvoiceDto> = {},
): CreateInvoiceDto {
  return {
    invoiceNo: 'INV-001',
    ...overrides,
  };
}

function getPrismaDelegate(
  mockPrisma: ReturnType<typeof createMockPrismaService>,
  delegate: keyof PrismaService,
): DelegateMock {
  return mockPrisma[delegate] as unknown as DelegateMock;
}

describe('InvoicesService', () => {
  let service: InvoicesService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockMailService: ReturnType<typeof createMockMailService>;
  let mockAuditLogsService: ReturnType<typeof createMockAuditLogsService>;
  let mockConfigService: ReturnType<typeof createMockConfigService>;

  const mockAdminUser = createMockAuthUser(Role.ADMIN);

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockMailService = createMockMailService();
    mockAuditLogsService = createMockAuditLogsService();
    mockConfigService = createMockConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMailService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requireWriteOrganization (organization enforcement)', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.create(
          createInvoiceDto(),
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when SUPER_ADMIN platform user has no organizationId selected', async () => {
      const platformAdmin = createMockAuthUser(Role.SUPER_ADMIN, {
        organizationId: null,
        isSuperAdmin: true,
      });
      await expect(
        service.create(createInvoiceDto(), platformAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return organizationId if valid', () => {
      const result = (service as any).requireWriteOrganization(mockAdminUser);
      expect(result).toBe(1);
    });
  });

  describe('create', () => {
    it('should create invoice successfully', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      const mockInvoice = { id: 1, invoiceNo: 'INV-001' };
      invoiceDelegate.create.mockResolvedValue(mockInvoice);

      const result = await service.create(createInvoiceDto(), mockAdminUser);

      expect(result).toEqual(mockInvoice);
      expect(invoiceDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceNo: 'INV-001',
            organization: { connect: { id: 1 } },
            user: { connect: { id: 1 } },
          }),
        }),
      );
    });

    it('calculates totals and persists line items for itemized invoices', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      invoiceDelegate.create.mockResolvedValue({
        id: 22,
        invoiceNo: 'INV-022',
      });

      await service.create(
        createInvoiceDto({
          totalAmount: 1,
          taxAmount: undefined,
          discountAmount: 10,
          discountType: 'PERCENTAGE',
          discountRate: 10,
          items: [
            {
              name: 'Consulting',
              quantity: 2,
              price: 100,
              discountAmount: 10,
              taxRate: 10,
            },
          ],
        }),
        mockAdminUser,
      );

      expect(invoiceDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 190,
            discount: 19,
            taxAmount: 19,
            totalAmount: 190,
            items: {
              create: [
                expect.objectContaining({
                  name: 'Consulting',
                  quantity: 2,
                  organization: { connect: { id: 1 } },
                }),
              ],
            },
          }),
        }),
      );
    });

    it('keeps supporting legacy amount-only invoice creation', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      invoiceDelegate.create.mockResolvedValue({
        id: 23,
        invoiceNo: 'INV-023',
      });

      await service.create(
        createInvoiceDto({ totalAmount: 250, taxAmount: 25, discount: 5 }),
        mockAdminUser,
      );

      expect(invoiceDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 230,
            totalAmount: 250,
            taxAmount: 25,
            discount: 5,
            items: undefined,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all invoices for organization', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      const mockInvoices = [{ id: 1, invoiceNo: 'INV-001' }];
      invoiceDelegate.findMany.mockResolvedValue(mockInvoices);

      const result = await service.findAll(mockAdminUser);

      expect(result).toEqual(mockInvoices);
      expect(invoiceDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 1, deletedAt: null },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if invoice not found', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      invoiceDelegate.findFirst.mockResolvedValue(null);

      await expect(service.findOne(999, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return invoice if found', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      const mockInvoice = { id: 1, invoiceNo: 'INV-001' };
      invoiceDelegate.findFirst.mockResolvedValue(mockInvoice);

      const result = await service.findOne(1, mockAdminUser);

      expect(result).toEqual(mockInvoice);
    });
  });

  describe('update', () => {
    it('should update invoice successfully', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      invoiceDelegate.findFirst.mockResolvedValue({
        id: 1,
        invoiceNo: 'INV-001',
      });
      invoiceDelegate.update.mockResolvedValue({ id: 1, invoiceNo: 'INV-002' });

      const result = await service.update(
        1,
        { invoiceNo: 'INV-002' },
        mockAdminUser,
      );

      expect(result.invoiceNo).toBe('INV-002');
    });

    it('allows non-financial edits after payments without replacing unchanged item rows', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      invoiceDelegate.findFirst.mockResolvedValue({
        id: 1,
        invoiceNo: 'INV-001',
        payments: [{ id: 9, amount: 25 }],
        items: [
          {
            id: 2,
            name: 'Consulting',
            productId: null,
            description: null,
            unit: 'Day',
            type: 'SERVICE',
            quantity: 1,
            price: 100,
            discountAmount: 0,
            taxRate: null,
          },
        ],
      });
      invoiceDelegate.update.mockResolvedValue({
        id: 1,
        notes: 'Updated note',
      });

      await service.update(
        1,
        {
          notes: 'Updated note',
          items: [
            {
              name: 'Consulting',
              unit: 'Day',
              type: 'SERVICE',
              quantity: 1,
              price: 100,
              discountAmount: 0,
              taxRate: 0,
            },
          ],
        },
        mockAdminUser,
      );

      const updateInput = invoiceDelegate.update.mock.calls[0][0];
      expect(updateInput.data.notes).toBe('Updated note');
      expect(updateInput.data).not.toHaveProperty('items');
    });

    it('rejects invoice line changes after a payment is recorded', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      invoiceDelegate.findFirst.mockResolvedValue({
        id: 1,
        invoiceNo: 'INV-001',
        payments: [{ id: 9, amount: 25 }],
        items: [
          {
            id: 2,
            name: 'Consulting',
            productId: null,
            description: null,
            unit: 'Day',
            type: 'SERVICE',
            quantity: 1,
            price: 100,
            discountAmount: 0,
            taxRate: null,
          },
        ],
      });

      await expect(
        service.update(
          1,
          {
            items: [
              {
                name: 'Consulting',
                unit: 'Day',
                type: 'SERVICE',
                quantity: 1,
                price: 120,
                discountAmount: 0,
                taxRate: 0,
              },
            ],
          },
          mockAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(invoiceDelegate.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete invoice', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      invoiceDelegate.findFirst.mockResolvedValue({
        id: 1,
        invoiceNo: 'INV-001',
      });
      invoiceDelegate.update.mockResolvedValue({
        id: 1,
        deletedAt: new Date(),
      });

      await service.remove(1, mockAdminUser);

      expect(invoiceDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('sendInvoice', () => {
    it('should send invoice successfully', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      const mockInvoice = {
        id: 1,
        invoiceNo: 'INV-001',
        clientEmail: 'client@example.com',
        user: { id: 1, name: 'Test User' },
      };
      invoiceDelegate.findFirst.mockResolvedValue(mockInvoice);
      invoiceDelegate.update.mockResolvedValue(mockInvoice);

      // Mock all ConfigService.get calls properly
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        switch (key) {
          case 'SMTP_FROM_EMAIL':
          case 'SENDGRID_FROM_EMAIL':
          case 'RESEND_FROM_EMAIL':
          case 'AWS_SES_FROM_EMAIL':
            return 'sender@example.com';
          case 'EMAIL_PROVIDER':
            return 'nodemailer';
          default:
            return '';
        }
      });

      (mockMailService.sendEmail as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await service.sendInvoice(1, {}, mockAdminUser);

      expect(result.success).toBe(true);
      expect(mockMailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            expect.objectContaining({
              filename: 'INV-001.pdf',
              contentType: 'application/pdf',
              content: expect.any(Buffer),
            }),
          ],
        }),
      );
      const emailInput = (mockMailService.sendEmail as jest.Mock).mock
        .calls[0][0];
      expect(
        emailInput.attachments[0].content.subarray(0, 5).toString('ascii'),
      ).toBe('%PDF-');
    });

    it('should throw BadRequestException if recipient email is missing', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      const mockInvoice = {
        id: 1,
        invoiceNo: 'INV-001',
        clientEmail: null,
        notes: null,
        user: { id: 1, name: 'Test User' },
      };
      invoiceDelegate.findFirst.mockResolvedValue(mockInvoice);

      await expect(service.sendInvoice(1, {}, mockAdminUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('importRecords', () => {
    it('should import valid invoices and skip invalid ones', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      const records = [{ invoiceNo: 'INV-001' }, { invalid: 'no invoiceNo' }];
      invoiceDelegate.create.mockResolvedValue({ id: 1 });

      const result = await service.importRecords(records, mockAdminUser);

      expect(result.imported).toBe(1);
      expect(result.errors.length).toBe(1);
    });
  });

  describe('getByStatus', () => {
    it('should return invoices grouped by status', async () => {
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      invoiceDelegate.findMany.mockResolvedValue([
        { id: 1, invoiceNo: 'INV-001', status: 'DRAFT' },
        { id: 2, invoiceNo: 'INV-002', status: 'SENT' },
      ]);

      const result = await service.getByStatus(mockAdminUser);

      expect(result.DRAFT.length).toBe(1);
      expect(result.SENT.length).toBe(1);
    });
  });
});
