import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectMessagesService } from './project-messages.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CompletionNotificationInterceptor } from '../common/interceptors/completion-notification.interceptor';
import { BusinessUnitsModule } from '../business-units/business-units.module';

@Module({
  imports: [PrismaModule, NotificationsModule, AuditLogsModule, BusinessUnitsModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectMessagesService,
    CompletionNotificationInterceptor,
  ],
})
export class ProjectsModule {}
