import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ReportsModule } from '../reports/reports.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EventsModule } from '../events/events.module';
import { ActivityTimelineModule } from '../activity-timeline/activity-timeline.module';
import { FileManagementModule } from '../file-management/file-management.module';
import { FileAttachmentsModule } from '../file-attachments/file-attachments.module';

@Module({
  imports: [
    DashboardModule,
    ReportsModule,
    AnalyticsModule,
    EventsModule,
    ActivityTimelineModule,
    FileManagementModule,
    FileAttachmentsModule,
  ],
  exports: [
    DashboardModule,
    ReportsModule,
    AnalyticsModule,
    EventsModule,
    ActivityTimelineModule,
    FileManagementModule,
    FileAttachmentsModule,
  ],
})
export class OperationsModule {}
