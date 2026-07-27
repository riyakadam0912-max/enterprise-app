import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeaveRequestsModule } from '../leave-requests/leave-requests.module';
import { AtsModule } from '../ats/ats.module';
import { EmployeeSelfServiceModule } from '../employee-self-service/employee-self-service.module';
import { PerformanceModule } from '../performance/performance.module';
import { PayrollModule } from '../payroll/payroll.module';

@Module({
  imports: [
    EmployeesModule,
    AttendanceModule,
    LeaveRequestsModule,
    AtsModule,
    EmployeeSelfServiceModule,
    PerformanceModule,
    PayrollModule,
  ],
  exports: [
    EmployeesModule,
    AttendanceModule,
    LeaveRequestsModule,
    AtsModule,
    EmployeeSelfServiceModule,
    PerformanceModule,
    PayrollModule,
  ],
})
export class HrModule {}
