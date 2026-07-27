import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { WorkflowModule } from '../workflows/workflow.module';

@Module({
  imports: [PrismaModule, CommonModule, AuditLogsModule, WorkflowModule],
  exports: [PrismaModule, CommonModule, AuditLogsModule, WorkflowModule],
})
export class CoreModule {}
