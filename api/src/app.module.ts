import { Module } from '@nestjs/common';
import { MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateServerEnv } from './config/env';

import { CoreModule } from './domains/core.module';
import { IdentityModule } from './domains/identity.module';
import { HrModule } from './domains/hr.module';
import { CrmModule } from './domains/crm.module';
import { ProjectsDomainModule } from './domains/projects.module';
import { FinanceModule } from './domains/finance.module';
import { InventoryModule } from './domains/inventory.module';
import { NotificationsDomainModule } from './domains/notifications-domain.module';
import { OperationsModule } from './domains/operations.module';
import { DynamicFormsModule } from './dynamic-forms/dynamic-forms.module';
import { FormSubmissionsModule } from './form-submissions/form-submissions.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AuditContextMiddleware } from './audit-logs/audit-context.middleware';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { resolveRedisConnection } from './config/redis';
import { EmailModule } from './email/email.module';

const redisConnection = resolveRedisConnection(process.env);

const queueImports = redisConnection
  ? [
      BullModule.forRoot({
        connection: redisConnection,
      }),
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '..', '.env'),
      ],
      validate: validateServerEnv,
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 300,
      max: 50,
    }),
    ...queueImports,
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 20,
        },
      ],
    }),
    CoreModule,
    IdentityModule,
    HrModule,
    CrmModule,
    ProjectsDomainModule,
    FinanceModule,
    InventoryModule,
    NotificationsDomainModule,
    OperationsModule,
    DynamicFormsModule,
    FormSubmissionsModule,
    OrganizationsModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService, TenantContextMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware, AuditContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
