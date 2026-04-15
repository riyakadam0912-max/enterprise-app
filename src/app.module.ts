import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LeadsModule } from './leads/leads.module';
import { TimesheetsModule } from './timesheets/timesheets.module';
import { DealsModule } from './deals/deals.module';
import { CampaignLeadsModule } from './campaign-leads/campaign-leads.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { InvoicesModule } from './invoices/invoices.module';
import { LedgerEntriesModule } from './ledger-entries/ledger-entries.module';
import { TicketsModule } from './tickets/tickets.module';
import { FormSubmissionsModule } from './form-submissions/form-submissions.module';
import { MarketingCampaignsModule } from './marketing-campaigns/marketing-campaigns.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { ContactsModule } from './contacts/contacts.module';
import { EventsModule } from './events/events.module';
import { DynamicFormsModule } from './dynamic-forms/dynamic-forms.module';
import { ActivitiesModule } from './activities/activities.module';
import { QuotesModule } from './quotes/quotes.module';
import { ProductsModule } from './products/products.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FileAttachmentsModule } from './file-attachments/file-attachments.module';
import { ReportsModule } from './reports/reports.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PayrollModule } from './payroll/payroll.module';
import { AtsModule } from './ats/ats.module';
import { PerformanceModule } from './performance/performance.module';
import { EmployeeSelfServiceModule } from './employee-self-service/employee-self-service.module';

const redisConnection = process.env.REDIS_URL
  ? {
      url: process.env.REDIS_URL,
    }
  : process.env.REDIS_HOST || process.env.REDIS_PORT
    ? {
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6379),
      }
    : null;

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
      envFilePath: '.env',
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 300,
      max: 500,
    }),
    ...queueImports,
    EventEmitterModule.forRoot(),
    CommonModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    EmployeesModule,
    DashboardModule,
    LeadsModule,
    TimesheetsModule,
    DealsModule,
    CampaignLeadsModule,
    LeaveRequestsModule,
    InvoicesModule,
    LedgerEntriesModule,
    TicketsModule,
    FormSubmissionsModule,
    MarketingCampaignsModule,
    ExpensesModule,
    ProjectsModule,
    TasksModule,
    ContactsModule,
    EventsModule,
    DynamicFormsModule,
    ActivitiesModule,
    QuotesModule,
    ProductsModule,
    PaymentsModule,
    NotificationsModule,
    FileAttachmentsModule,
    ReportsModule,
    AuditLogsModule,
    AttendanceModule,
    PayrollModule,
    AtsModule,
    PerformanceModule,
    EmployeeSelfServiceModule,
  ],
  controllers: [AppController],
  providers:   [AppService],
})
export class AppModule {}