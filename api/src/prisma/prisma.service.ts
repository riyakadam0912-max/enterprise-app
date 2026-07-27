import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { softDeleteMiddleware } from '../../prisma/middleware/softDelete';
import { getAuditContext } from '../audit-logs/audit-context';

const MODEL_TO_MODULE: Record<string, string> = {
  User: 'Users',
  Employee: 'HR',
  Attendance: 'Attendance',
  LeaveRequest: 'Leave',
  SalaryStructure: 'Payroll',
  PayrollCycle: 'Payroll',
  PayrollEntry: 'Payroll',
  Payslip: 'Payroll',
  Task: 'Tasks',
  Project: 'Projects',
  Lead: 'CRM',
  Deal: 'CRM',
  Contact: 'CRM',
  CampaignLead: 'CRM',
  Invoice: 'Accounting',
  LedgerEntry: 'Accounting',
  Payment: 'Accounting',
  Product: 'Inventory',
  File: 'Assets',
  FileActivity: 'Assets',
  FileAttachment: 'Assets',
  Quote: 'CRM',
  RolePermission: 'Roles & Permissions',
  Permission: 'Roles & Permissions',
  AppRole: 'Roles & Permissions',
};

const SENSITIVE_KEYS = /password|token|refreshToken|otp|secret|apiKey|session/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function redactValue(value: unknown): Prisma.JsonValue {
  if (value === null || value === undefined) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (isRecord(value)) {
    const result: Record<string, Prisma.JsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = SENSITIVE_KEYS.test(key) ? '***' : redactValue(entry);
    }
    return result;
  }

  return '[unsupported value]';
}

function stringifyStable(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyStable(item)).join(',')}]`;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, entry]) => `${key}:${stringifyStable(entry)}`).join(',')}}`;
  }

  return JSON.stringify(value) ?? '[object Object]';
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
    });

    this.$use(softDeleteMiddleware());
    this.$use(
      async (
        params: Prisma.MiddlewareParams,
        next: (params: Prisma.MiddlewareParams) => Promise<unknown>,
      ) => {
        if (
          !params.model ||
          params.model === 'AuditLog' ||
          params.model === 'ActivityTimeline' ||
          params.model === 'ActivityTimelineComment'
        ) {
          return await next(params);
        }

        const action = params.action;
        if (!['create', 'update', 'delete'].includes(action)) {
          return await next(params);
        }

        const auditContext = getAuditContext();
        const modelName = params.model;
        const moduleName = MODEL_TO_MODULE[modelName] ?? modelName;
        const argsRecord = isRecord(params.args) ? params.args : {};
        const whereRecord = isRecord(argsRecord.where) ? argsRecord.where : {};

        let beforeRecord: Record<string, unknown> | null = null;

        if (action !== 'create') {
          const existingRecord = await this.findExistingRecord(
            modelName,
            whereRecord,
          );
          beforeRecord = isRecord(existingRecord) ? existingRecord : null;
        }

        const result = await next(params);
        const afterRecord =
          action === 'delete' ? null : isRecord(result) ? result : null;

        let organizationId = auditContext.organizationId ?? null;
        if (organizationId == null && auditContext.userId) {
          const auditUser = await this.user.findUnique({
            where: { id: auditContext.userId },
            select: { organizationId: true },
          });
          organizationId = auditUser?.organizationId ?? null;
        }
        if (
          organizationId == null &&
          params.action === 'create' &&
          isRecord(argsRecord.data) &&
          'organizationId' in argsRecord.data
        ) {
          const createdOrganizationId = argsRecord.data.organizationId;
          organizationId =
            typeof createdOrganizationId === 'number'
              ? createdOrganizationId
              : null;
        }
        if (
          organizationId == null &&
          beforeRecord &&
          'organizationId' in beforeRecord
        ) {
          const previousOrganizationId = beforeRecord.organizationId;
          organizationId =
            typeof previousOrganizationId === 'number'
              ? previousOrganizationId
              : null;
        }
        if (
          organizationId == null &&
          afterRecord &&
          'organizationId' in afterRecord
        ) {
          const nextOrganizationId = afterRecord.organizationId;
          organizationId =
            typeof nextOrganizationId === 'number' ? nextOrganizationId : null;
        }
        if (organizationId == null && modelName === 'Organization') {
          organizationId =
            typeof afterRecord?.id === 'number'
              ? afterRecord.id
              : typeof beforeRecord?.id === 'number'
                ? beforeRecord.id
                : null;
        }

        // Ensure organizationId is always set for audit logging (required by schema)
        if (organizationId == null) {
          const defaultOrg = await this.organization.findFirst({
            orderBy: { id: 'asc' },
            select: { id: true },
          });
          organizationId = defaultOrg?.id ?? null;
        }

        if (organizationId != null) {
          const organizationExists = await this.organization.findUnique({
            where: { id: organizationId },
            select: { id: true },
          });
          if (!organizationExists) {
            return result;
          }
        }

        const entityId =
          typeof afterRecord?.id === 'number'
            ? afterRecord.id
            : typeof beforeRecord?.id === 'number'
              ? beforeRecord.id
              : null;

        // Skip audit logging if organizationId cannot be resolved
        if (organizationId == null) {
          return result;
        }

        if (action === 'update' && beforeRecord && afterRecord) {
          const changedFields = new Set([
            ...Object.keys(beforeRecord),
            ...Object.keys(afterRecord),
          ]);
          for (const fieldName of changedFields) {
            if (
              fieldName === 'createdAt' ||
              fieldName === 'updatedAt' ||
              fieldName === 'deletedAt'
            )
              continue;
            const oldValue = redactValue(beforeRecord[fieldName]);
            const newValue = redactValue(afterRecord[fieldName]);
            if (stringifyStable(oldValue) === stringifyStable(newValue))
              continue;

            await this.auditLog.create({
              data: {
                userId: auditContext.userId ?? undefined,
                userName: auditContext.userName ?? undefined,
                userRole: auditContext.userRole ?? undefined,
                module: moduleName,
                entityType: modelName,
                entityId: entityId ?? undefined,
                action: 'UPDATE',
                fieldName,
                oldValue: oldValue as Prisma.InputJsonValue | undefined,
                newValue: newValue as Prisma.InputJsonValue | undefined,
                description: `${auditContext.userRole ?? auditContext.userName ?? 'System'} updated ${modelName} #${entityId ?? 'N/A'}`,
                ipAddress: auditContext.ipAddress ?? undefined,
                deviceInfo: auditContext.deviceInfo ?? undefined,
                requestMethod: auditContext.requestMethod ?? undefined,
                endpoint: auditContext.endpoint ?? undefined,
                status: 'SUCCESS',
                organizationId,
              },
            });
          }
        } else {
          await this.auditLog.create({
            data: {
              userId: auditContext.userId ?? undefined,
              userName: auditContext.userName ?? undefined,
              userRole: auditContext.userRole ?? undefined,
              module: moduleName,
              entityType: modelName,
              entityId: entityId ?? undefined,
              action: action.toUpperCase(),
              fieldName: undefined,
              oldValue:
                action === 'delete'
                  ? (redactValue(beforeRecord) as Prisma.InputJsonValue)
                  : undefined,
              newValue:
                action === 'create'
                  ? (redactValue(afterRecord) as Prisma.InputJsonValue)
                  : undefined,
              description: `${auditContext.userRole ?? auditContext.userName ?? 'System'} ${action}d ${modelName}${entityId ? ` #${entityId}` : ''}`,
              ipAddress: auditContext.ipAddress ?? undefined,
              deviceInfo: auditContext.deviceInfo ?? undefined,
              requestMethod: auditContext.requestMethod ?? undefined,
              endpoint: auditContext.endpoint ?? undefined,
              status: 'SUCCESS',
              organizationId,
            },
          });
        }

        return result;
      },
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async updateSoftDeleteState(
    model: string,
    id: number,
    deletedAt: Date | null,
  ) {
    switch (model) {
      case 'User':
        return this.user.update({ where: { id }, data: { deletedAt } });
      case 'Employee':
        return this.employee.update({ where: { id }, data: { deletedAt } });
      case 'Attendance':
        return this.attendance.update({ where: { id }, data: { deletedAt } });
      case 'LeaveRequest':
        return this.leaveRequest.update({ where: { id }, data: { deletedAt } });
      case 'SalaryStructure':
        return this.salaryStructure.update({
          where: { id },
          data: { deletedAt },
        });
      case 'PayrollCycle':
        return this.payrollCycle.update({ where: { id }, data: { deletedAt } });
      case 'PayrollEntry':
        return this.payrollEntry.update({ where: { id }, data: { deletedAt } });
      case 'Payslip':
        return this.payslip.update({ where: { id }, data: { deletedAt } });
      case 'Task':
        return this.task.update({ where: { id }, data: { deletedAt } });
      case 'Project':
        return this.project.update({ where: { id }, data: { deletedAt } });
      case 'Lead':
        return this.lead.update({ where: { id }, data: { deletedAt } });
      case 'Deal':
        return this.deal.update({ where: { id }, data: { deletedAt } });
      case 'Contact':
        return this.contact.update({ where: { id }, data: { deletedAt } });
      case 'CampaignLead':
        return this.campaignLead.update({ where: { id }, data: { deletedAt } });
      case 'Invoice':
        return this.invoice.update({ where: { id }, data: { deletedAt } });
      case 'LedgerEntry':
        return this.ledgerEntry.update({ where: { id }, data: { deletedAt } });
      case 'Payment':
        return this.payment.update({ where: { id }, data: { deletedAt } });
      case 'Product':
        return this.product.update({ where: { id }, data: { deletedAt } });
      case 'File':
        return this.file.update({ where: { id }, data: { deletedAt } });
      case 'FileActivity':
        if (deletedAt === null) {
          return this.fileActivity.findUnique({ where: { id } });
        }
        return this.fileActivity.delete({ where: { id } });
      case 'FileAttachment':
        return this.fileAttachment.update({
          where: { id },
          data: { deletedAt },
        });
      case 'Quote':
        return this.quote.update({ where: { id }, data: { deletedAt } });
      case 'RolePermission':
        return this.rolePermission.update({
          where: { roleId_permissionId: { roleId: id, permissionId: id } },
          data: { createdAt: new Date() },
        });
      case 'Permission':
        return this.permission.update({
          where: { id },
          data: { description: null },
        });
      case 'AppRole':
        return this.appRole.update({
          where: { id },
          data: { name: 'Archived' },
        });
      case 'Organization':
        return this.organization.update({ where: { id }, data: { deletedAt } });
      case 'AuditLog':
        return this.auditLog.update({
          where: { id },
          data: { description: null },
        });
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  }

  private async findExistingRecord(
    modelName: string,
    where: Record<string, unknown>,
  ) {
    const id = typeof where.id === 'number' ? where.id : undefined;
    const roleId = typeof where.roleId === 'number' ? where.roleId : undefined;
    const permissionId =
      typeof where.permissionId === 'number' ? where.permissionId : undefined;
    const compoundRolePermission = isRecord(where.roleId_permissionId)
      ? where.roleId_permissionId
      : null;
    const compoundRoleId =
      compoundRolePermission &&
      typeof compoundRolePermission.roleId === 'number'
        ? compoundRolePermission.roleId
        : undefined;
    const compoundPermissionId =
      compoundRolePermission &&
      typeof compoundRolePermission.permissionId === 'number'
        ? compoundRolePermission.permissionId
        : undefined;

    switch (modelName) {
      case 'User':
        return id !== undefined
          ? this.user.findUnique({ where: { id } })
          : null;
      case 'Employee':
        return id !== undefined
          ? this.employee.findUnique({ where: { id } })
          : null;
      case 'Attendance':
        return id !== undefined
          ? this.attendance.findUnique({ where: { id } })
          : null;
      case 'LeaveRequest':
        return id !== undefined
          ? this.leaveRequest.findUnique({ where: { id } })
          : null;
      case 'SalaryStructure':
        return id !== undefined
          ? this.salaryStructure.findUnique({ where: { id } })
          : null;
      case 'PayrollCycle':
        return id !== undefined
          ? this.payrollCycle.findUnique({ where: { id } })
          : null;
      case 'PayrollEntry':
        return id !== undefined
          ? this.payrollEntry.findUnique({ where: { id } })
          : null;
      case 'Payslip':
        return id !== undefined
          ? this.payslip.findUnique({ where: { id } })
          : null;
      case 'Task':
        return id !== undefined
          ? this.task.findUnique({ where: { id } })
          : null;
      case 'Project':
        return id !== undefined
          ? this.project.findUnique({ where: { id } })
          : null;
      case 'Lead':
        return id !== undefined
          ? this.lead.findUnique({ where: { id } })
          : null;
      case 'Deal':
        return id !== undefined
          ? this.deal.findUnique({ where: { id } })
          : null;
      case 'Contact':
        return id !== undefined
          ? this.contact.findUnique({ where: { id } })
          : null;
      case 'CampaignLead':
        return id !== undefined
          ? this.campaignLead.findUnique({ where: { id } })
          : null;
      case 'Invoice':
        return id !== undefined
          ? this.invoice.findUnique({ where: { id } })
          : null;
      case 'LedgerEntry':
        return id !== undefined
          ? this.ledgerEntry.findUnique({ where: { id } })
          : null;
      case 'Payment':
        return id !== undefined
          ? this.payment.findUnique({ where: { id } })
          : null;
      case 'Product':
        return id !== undefined
          ? this.product.findUnique({ where: { id } })
          : null;
      case 'File':
        return id !== undefined
          ? this.file.findUnique({ where: { id } })
          : null;
      case 'FileActivity':
        return id !== undefined
          ? this.fileActivity.findUnique({ where: { id } })
          : null;
      case 'FileAttachment':
        return id !== undefined
          ? this.fileAttachment.findUnique({ where: { id } })
          : null;
      case 'Quote':
        return id !== undefined
          ? this.quote.findUnique({ where: { id } })
          : null;
      case 'RolePermission':
        return (roleId !== undefined && permissionId !== undefined) ||
          (compoundRoleId !== undefined && compoundPermissionId !== undefined)
          ? this.rolePermission.findUnique({
              where: {
                roleId_permissionId: {
                  roleId: roleId ?? compoundRoleId ?? 0,
                  permissionId: permissionId ?? compoundPermissionId ?? 0,
                },
              },
            })
          : null;
      case 'Permission':
        return id !== undefined
          ? this.permission.findUnique({ where: { id } })
          : null;
      case 'AppRole':
        return id !== undefined
          ? this.appRole.findUnique({ where: { id } })
          : null;
      case 'Organization':
        return id !== undefined
          ? this.organization.findUnique({ where: { id } })
          : null;
      case 'AuditLog':
        return id !== undefined
          ? this.auditLog.findUnique({ where: { id } })
          : null;
      default:
        return null;
    }
  }

  async softDeleteById(model: string, id: number) {
    return await this.updateSoftDeleteState(model, id, new Date());
  }

  async restoreById(model: string, id: number) {
    return await this.updateSoftDeleteState(model, id, null);
  }
}
