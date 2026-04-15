import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequestNotificationListener } from './listeners/leave-request-notification.listener';

@Module({
  imports:     [PrismaModule, NotificationsModule, MailModule],
  controllers: [LeaveRequestsController],
  providers:   [LeaveRequestsService, LeaveRequestNotificationListener],
})
export class LeaveRequestsModule {}
