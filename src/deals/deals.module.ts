import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DealWonListener } from './listeners/deal-won.listener';
import { DealWonActionService } from './services/deal-won-action.service';
import { DealProcessor } from './deal.processor';

const redisConfigured = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST || process.env.REDIS_PORT);
const queueImports = redisConfigured
  ? [BullModule.registerQueue({ name: 'deal-queue' })]
  : [];
const queueProviders = redisConfigured ? [DealProcessor] : [];

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AuditLogsModule,
    ...queueImports,
  ],
  controllers: [DealsController],
  providers: [DealsService, DealWonListener, DealWonActionService, ...queueProviders],
})
export class DealsModule {}
