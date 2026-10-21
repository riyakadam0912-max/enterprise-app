import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequestNotificationListener } from './listeners/leave-request-notification.listener';
import { BusinessUnitsModule } from '../business-units/business-units.module';
import { LeaveEntitlementsService } from './leave-entitlements.service';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    MailModule,
    WorkflowModule,
    BusinessUnitsModule,
  ],
  controllers: [LeaveRequestsController],
  providers: [
    LeaveRequestsService,
    LeaveEntitlementsService,
    LeaveRequestNotificationListener,
  ],
  exports: [LeaveRequestsService, LeaveEntitlementsService],
})
export class LeaveRequestsModule {}
