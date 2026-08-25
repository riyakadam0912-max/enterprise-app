import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { BusinessUnitsModule } from '../business-units/business-units.module';

@Module({
  imports: [PrismaModule, BusinessUnitsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
