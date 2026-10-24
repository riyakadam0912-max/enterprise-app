import { ApplicationConfigModule } from './config/application-config.module';
import { Module } from '@nestjs/common';
import { MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthThrottlingModule } from './auth/auth-throttling.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

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
import { BusinessUnitsModule } from './business-units/business-units.module';
import { AuditContextMiddleware } from './audit-logs/audit-context.middleware';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { resolveRedisConnection } from './config/redis';
import { redisConnectionOptions } from './config/redis-options';
import { EmailModule } from './email/email.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { CustomersModule } from './customers/customers.module';

const redisConnection = resolveRedisConnection(process.env);

const queueImports = redisConnection
  ? [
      BullModule.forRoot({
        connection: redisConnectionOptions(redisConnection),
      }),
    ]
  : [];

@Module({
  imports: [
    ApplicationConfigModule,
    CacheModule.register({
      isGlobal: true,
      ttl: 300_000,
      max: 50,
    }),
    ...queueImports,
    EventEmitterModule.forRoot(),
    AuthThrottlingModule,
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
    BusinessUnitsModule,
    EmailModule,
    ClientPortalModule,
    CustomersModule,
  ],
  controllers: [AppController],
  providers: [AppService, TenantContextMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuditContextMiddleware, TenantContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
