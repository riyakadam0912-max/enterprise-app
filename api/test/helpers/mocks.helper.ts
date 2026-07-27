import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MailService } from '../../src/mail/mail.service';
import { WorkflowEngineService } from '../../src/workflows/workflow-engine.service';
import { NotificationsService } from '../../src/notifications/notifications.service';

export type DelegateMock = {
  findUnique: jest.Mock;
  findUniqueOrThrow: jest.Mock;
  findFirst: jest.Mock;
  findFirstOrThrow: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  createManyAndReturn: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  groupBy: jest.Mock;
  fields: Record<string, unknown>;
};

function createDelegateMock(): DelegateMock {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    createManyAndReturn: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    fields: {},
  };
}

function isDelegateMock(value: unknown): value is DelegateMock {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const requiredMethods: Array<Exclude<keyof DelegateMock, 'fields'>> = [
    'findUnique',
    'findUniqueOrThrow',
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'create',
    'createMany',
    'createManyAndReturn',
    'update',
    'updateMany',
    'upsert',
    'delete',
    'deleteMany',
    'count',
    'aggregate',
    'groupBy',
  ];

  return (
    requiredMethods.every(
      (method) => typeof Reflect.get(value, method) === 'function',
    ) &&
    typeof Reflect.get(value, 'fields') === 'object' &&
    Reflect.get(value, 'fields') !== null
  );
}

export type MockPrismaService = Partial<
  Record<keyof PrismaService, unknown>
> & {
  user: DelegateMock;
  employee: DelegateMock;
  attendance: DelegateMock;
  shift: DelegateMock;
  leaveRequest: DelegateMock;
  timesheet: DelegateMock;
  salaryStructure: DelegateMock;
  payrollCycle: DelegateMock;
  payrollEntry: DelegateMock;
  payslip: DelegateMock;
  task: DelegateMock;
  project: DelegateMock;
  projectLink: DelegateMock;
  lead: DelegateMock;
  deal: DelegateMock;
  contact: DelegateMock;
  activity: DelegateMock;
  campaignLead: DelegateMock;
  invoice: DelegateMock;
  ledgerEntry: DelegateMock;
  payment: DelegateMock;
  product: DelegateMock;
  file: DelegateMock;
  fileActivity: DelegateMock;
  fileAttachment: DelegateMock;
  quote: DelegateMock;
  rolePermission: DelegateMock;
  permission: DelegateMock;
  appRole: DelegateMock;
  organization: DelegateMock;
  auditLog: DelegateMock;
  expense: DelegateMock;
  userRole: DelegateMock;
  $executeRawUnsafe: jest.Mock;
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
  softDeleteById: jest.Mock;
  restoreById: jest.Mock;
  $connect: jest.Mock;
};

export type MockJwtService = {
  sign: jest.Mock;
  verify: jest.Mock;
  signAsync: jest.Mock;
  verifyAsync: jest.Mock;
};

export type MockAuditLogsService = {
  create: jest.Mock;
  logCreate: jest.Mock;
  logUpdate: jest.Mock;
  logDelete: jest.Mock;
  logLogin: jest.Mock;
  logLogout: jest.Mock;
  logCustomAction: jest.Mock;
  logFieldDiffs: jest.Mock;
  findAll: jest.Mock;
  findOne: jest.Mock;
  findByUser: jest.Mock;
  findByModule: jest.Mock;
  findByEntity: jest.Mock;
};

type MockPrismaDelegateKey = Exclude<
  {
    [Key in keyof MockPrismaService]: MockPrismaService[Key] extends DelegateMock
      ? Key
      : never;
  }[keyof MockPrismaService],
  undefined
>;

export const createMockPrismaService = (): MockPrismaService => ({
  user: createDelegateMock(),
  employee: createDelegateMock(),
  attendance: createDelegateMock(),
  shift: createDelegateMock(),
  leaveRequest: createDelegateMock(),
  timesheet: createDelegateMock(),
  salaryStructure: createDelegateMock(),
  payrollCycle: createDelegateMock(),
  payrollEntry: createDelegateMock(),
  payslip: createDelegateMock(),
  task: createDelegateMock(),
  project: createDelegateMock(),
  projectLink: createDelegateMock(),
  lead: createDelegateMock(),
  deal: createDelegateMock(),
  contact: createDelegateMock(),
  activity: createDelegateMock(),
  campaignLead: createDelegateMock(),
  invoice: createDelegateMock(),
  ledgerEntry: createDelegateMock(),
  payment: createDelegateMock(),
  product: createDelegateMock(),
  file: createDelegateMock(),
  fileActivity: createDelegateMock(),
  fileAttachment: createDelegateMock(),
  quote: createDelegateMock(),
  rolePermission: createDelegateMock(),
  permission: createDelegateMock(),
  appRole: createDelegateMock(),
  organization: createDelegateMock(),
  auditLog: createDelegateMock(),
  expense: createDelegateMock(),
  userRole: createDelegateMock(),
  $executeRawUnsafe: jest.fn(),
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
  softDeleteById: jest.fn(),
  restoreById: jest.fn(),
  $connect: jest.fn(),
});

export function getMockPrismaDelegate(
  mockPrisma: MockPrismaService,
  delegate: MockPrismaDelegateKey,
): DelegateMock {
  const candidate = mockPrisma[delegate];
  if (!isDelegateMock(candidate)) {
    throw new Error(
      `Prisma delegate "${String(delegate)}" is not configured as a DelegateMock`,
    );
  }

  return candidate;
}

export const createMockCacheManager = () => ({
  del: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
});

export const createMockJwtService = (): MockJwtService => ({
  sign: jest.fn(),
  verify: jest.fn(),
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
});

export const createMockConfigService = (): Partial<ConfigService> => ({
  get: jest.fn(),
  getOrThrow: jest.fn(),
});

export const createMockMailService = (): Partial<MailService> => ({
  sendEmail: jest.fn(),
  sendTemplatedEmail: jest.fn(),
  sendBatchEmails: jest.fn(),
  sendLeaveRequestNotification: jest.fn(),
  sendLeaveApprovalNotification: jest.fn(),
  sendLeaveRejectionNotification: jest.fn(),
  getProviderHealth: jest.fn(),
});

export const createMockAuditLogsService = (): MockAuditLogsService => ({
  create: jest.fn(),
  logCreate: jest.fn(),
  logUpdate: jest.fn(),
  logDelete: jest.fn(),
  logLogin: jest.fn(),
  logLogout: jest.fn(),
  logCustomAction: jest.fn(),
  logFieldDiffs: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByUser: jest.fn(),
  findByModule: jest.fn(),
  findByEntity: jest.fn(),
});

export const createMockThrottlerModuleOptions = () => ({
  throttlers: [
    {
      ttl: 60,
      limit: 10,
    },
  ],
});

export const createMockWorkflowEngineService =
  (): Partial<WorkflowEngineService> => ({
    getInstanceByEntity: jest.fn(),
    submitWorkflow: jest.fn(),
    approveWorkflow: jest.fn(),
    rejectWorkflow: jest.fn(),
  });

export const createMockNotificationsService =
  (): Partial<NotificationsService> => ({
    sendNotification: jest.fn(),
  });

export const createMockEventEmitter2 = () => ({
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
});
