import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockPrismaService,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreatePaymentDto } from './dto/create-payment.dto';

// Helper to create valid mock AuthUser
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
    employeeId: role === Role.EMPLOYEE ? 101 : null,
    organizationId: 1,
    tokenType: 'Bearer',
    jti: null,
    ...overrides,
  };
}

// Type assertion to ensure mock Prisma delegates are not undefined and have Jest mock properties
function getPrismaDelegate(
  mockPrisma: ReturnType<typeof createMockPrismaService>,
  delegate: keyof PrismaService,
): DelegateMock {
  return mockPrisma[delegate] as unknown as DelegateMock;
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  const mockAdminUser = createMockAuthUser(Role.ADMIN, { userId: 1 });

  beforeEach(async () => {
    // Create fresh mocks for each test!
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      const dto: CreatePaymentDto = {
        invoiceId: 1,
        amount: 100,
        paymentMethod: 'CREDIT_CARD',
        transactionId: 'txn_123',
        paymentDate: '2026-01-01',
        status: 'PAID',
      };
      await expect(
        service.create(
          dto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a payment successfully for admin', async () => {
      const paymentDelegate = getPrismaDelegate(mockPrisma, 'payment');
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      const mockPayment = {
        id: 1,
        organizationId: 1,
        invoiceId: 1,
        amount: 100,
        invoice: { id: 1, totalAmount: 200 },
      };
      paymentDelegate.create.mockResolvedValueOnce(mockPayment);
      invoiceDelegate.findUnique.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        totalAmount: 200,
        status: 'ISSUED',
      });

      const dto: CreatePaymentDto = {
        invoiceId: 1,
        amount: 100,
        paymentMethod: 'CREDIT_CARD',
        transactionId: 'txn_123',
        paymentDate: '2026-01-01',
        status: 'PAID',
      };
      const result = await service.create(dto, mockAdminUser);
      expect(result).toEqual(mockPayment);
      expect(paymentDelegate.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.findAll(
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return all payments for the organization', async () => {
      const paymentDelegate = getPrismaDelegate(mockPrisma, 'payment');
      const mockPayments = [
        {
          id: 1,
          organizationId: 1,
          invoiceId: 1,
          amount: 100,
          invoice: { id: 1, totalAmount: 200 },
        },
      ];
      paymentDelegate.findMany.mockResolvedValueOnce(mockPayments);

      const result = await service.findAll(mockAdminUser);
      expect(result).toEqual(mockPayments);
      expect(paymentDelegate.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByInvoice', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.findByInvoice(
          1,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return payments, total, paid, and remaining amount for an invoice', async () => {
      const paymentDelegate = getPrismaDelegate(mockPrisma, 'payment');
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');

      const mockPayments = [
        { id: 1, organizationId: 1, invoiceId: 1, amount: 50 },
        { id: 2, organizationId: 1, invoiceId: 1, amount: 75 },
      ];
      const mockInvoice = { id: 1, organizationId: 1, totalAmount: 200 };

      paymentDelegate.findMany.mockResolvedValueOnce(mockPayments);
      invoiceDelegate.findUnique.mockResolvedValueOnce(mockInvoice);

      const result = await service.findByInvoice(1, mockAdminUser);
      expect(result.payments).toEqual(mockPayments);
      expect(result.totalAmount).toEqual(200);
      expect(result.paidAmount).toEqual(125);
      expect(result.remainingAmount).toEqual(75);
    });

    it('should reject when invoice is not found in the organization', async () => {
      const paymentDelegate = getPrismaDelegate(mockPrisma, 'payment');
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');

      invoiceDelegate.findUnique.mockResolvedValueOnce(null);

      await expect(service.findByInvoice(1, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('excludes pending and failed payments from the paid amount', async () => {
      const paymentDelegate = getPrismaDelegate(mockPrisma, 'payment');
      const invoiceDelegate = getPrismaDelegate(mockPrisma, 'invoice');
      paymentDelegate.findMany.mockResolvedValueOnce([
        { id: 1, amount: 50, status: 'COMPLETED' },
        { id: 2, amount: 25, status: 'PENDING' },
        { id: 3, amount: 10, status: 'FAILED' },
        { id: 4, amount: 5, status: 'REFUNDED' },
      ]);
      invoiceDelegate.findUnique.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        totalAmount: 100,
        status: 'ISSUED',
      });

      await expect(service.findByInvoice(1, mockAdminUser)).resolves.toMatchObject({
        paidAmount: 45,
        remainingAmount: 55,
      });
    });

    it('rejects non-positive payment amounts', async () => {
      await expect(
        service.create(
          {
            invoiceId: 1,
            amount: 0,
            paymentMethod: 'CASH',
            paymentDate: '2026-01-01',
            status: 'COMPLETED',
          },
          mockAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
