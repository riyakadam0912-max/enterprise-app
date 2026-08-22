import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityTimelineController } from './activity-timeline.controller';
import { ActivityTimelineGateway } from './activity-timeline.gateway';
import { NoOpActivityTimelineGateway } from './noop-activity-timeline.gateway';
import { ActivityTimelineListener } from './activity-timeline.listener';
import { ActivityTimelineService } from './activity-timeline.service';

const activityTimelineGatewayProvider: Provider = {
  provide: ActivityTimelineGateway,
  useFactory: (configService: ConfigService) => {
    const enabled = configService.get<boolean>('WEBSOCKET_ENABLED') ?? false;
    if (enabled) {
      return new ActivityTimelineGateway(configService);
    }
    return new NoOpActivityTimelineGateway() as unknown as ActivityTimelineGateway;
  },
  inject: [ConfigService],
};

@Module({
  imports: [PrismaModule, AuditLogsModule, NotificationsModule],
  controllers: [ActivityTimelineController],
  providers: [
    activityTimelineGatewayProvider,
    ActivityTimelineService,
    ActivityTimelineListener,
  ],
  exports: [ActivityTimelineService],
})
export class ActivityTimelineModule {}
