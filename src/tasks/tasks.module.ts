import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CompletionNotificationInterceptor } from '../common/interceptors/completion-notification.interceptor';

@Module({
  imports: [PrismaModule, NotificationsModule, AuditLogsModule],
  controllers: [TasksController],
  providers: [TasksService, CompletionNotificationInterceptor],
})
export class TasksModule {}
