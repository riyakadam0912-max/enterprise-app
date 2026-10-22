import { Module } from '@nestjs/common';
import { EmployeeSelfServiceController } from './employee-self-service.controller';
import { EmployeeSelfServiceService } from './employee-self-service.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LeaveRequestsModule } from '../leave-requests/leave-requests.module';
import { TasksModule } from '../tasks/tasks.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [PrismaModule, LeaveRequestsModule, TasksModule, AttendanceModule],
  controllers: [EmployeeSelfServiceController],
  providers: [EmployeeSelfServiceService],
  exports: [EmployeeSelfServiceService],
})
export class EmployeeSelfServiceModule {}
