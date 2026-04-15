import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CompletionNotificationInterceptor } from '../common/interceptors/completion-notification.interceptor';

@Module({
  imports: [PrismaModule, NotificationsModule, AuditLogsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, CompletionNotificationInterceptor],
})
export class ProjectsModule {}
