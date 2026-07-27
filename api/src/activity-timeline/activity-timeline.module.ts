import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityTimelineController } from './activity-timeline.controller';
import { ActivityTimelineGateway } from './activity-timeline.gateway';
import { ActivityTimelineListener } from './activity-timeline.listener';
import { ActivityTimelineService } from './activity-timeline.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, NotificationsModule],
  controllers: [ActivityTimelineController],
  providers: [
    ActivityTimelineGateway,
    ActivityTimelineService,
    ActivityTimelineListener,
  ],
  exports: [ActivityTimelineService],
})
export class ActivityTimelineModule {}
