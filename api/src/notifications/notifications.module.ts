import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NoOpNotificationsGateway } from './noop-notifications.gateway';
import { NotificationEventListener } from './notification-event.listener';
import { NotificationTemplateService } from './notification-template.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

const notificationsGatewayProvider: Provider = {
  provide: NotificationsGateway,
  useFactory: (configService: ConfigService, jwtService: JwtService) => {
    const enabled = configService.get<boolean>('WEBSOCKET_ENABLED') ?? false;
    if (enabled) {
      return new NotificationsGateway(jwtService, configService);
    }
    return new NoOpNotificationsGateway() as unknown as NotificationsGateway;
  },
  inject: [ConfigService, JwtService],
};

@Module({
  imports: [PrismaModule, AuditLogsModule, MailModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    notificationsGatewayProvider,
    NotificationEventListener,
    NotificationTemplateService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
