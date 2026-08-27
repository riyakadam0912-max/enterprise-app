import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CompletionNotificationInterceptor } from '../common/interceptors/completion-notification.interceptor';
import { WorkflowModule } from '../workflows/workflow.module';
import { BusinessUnitsModule } from '../business-units/business-units.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AuditLogsModule,
    WorkflowModule,
    BusinessUnitsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, CompletionNotificationInterceptor],
})
export class TasksModule {}
