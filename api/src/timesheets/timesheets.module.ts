import { Module } from '@nestjs/common';
import { TimesheetsService } from './timesheets.service';
import { TimesheetsController } from './timesheets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AttendanceTaskHoursService } from './attendance-task-hours.service';

@Module({
  imports: [PrismaModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsService, AttendanceTaskHoursService],
  exports: [AttendanceTaskHoursService],
})
export class TimesheetsModule {}
