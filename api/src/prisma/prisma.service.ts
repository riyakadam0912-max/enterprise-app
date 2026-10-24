import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { softDeleteMiddleware } from '../../prisma/middleware/softDelete';
import { automaticAuditMiddleware } from '../audit-logs/automatic-audit.middleware';
import { runWithAuditTransaction } from '../audit-logs/audit-transaction';

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

    // Audit sees the original delete action before soft deletion rewrites it.
    this.$use(automaticAuditMiddleware(this));
    this.$use(softDeleteMiddleware());
    const transaction = this.$transaction.bind(this);
    this.$transaction = ((input: unknown, options: unknown) => {
      if (typeof input === 'function') {
        return Reflect.apply(transaction, this, [
          (tx: Prisma.TransactionClient) =>
            runWithAuditTransaction(this, tx, () => input(tx)),
          options,
        ]);
      }
      return Reflect.apply(transaction, this, [input, options]);
    }) as typeof this.$transaction;
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

  async softDeleteById(model: string, id: number) {
    return await this.updateSoftDeleteState(model, id, new Date());
  }

  async restoreById(model: string, id: number) {
    return await this.updateSoftDeleteState(model, id, null);
  }
}
