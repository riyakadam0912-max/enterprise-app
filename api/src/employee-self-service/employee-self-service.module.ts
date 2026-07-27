import { Module } from '@nestjs/common';
import { EmployeeSelfServiceController } from './employee-self-service.controller';
import { EmployeeSelfServiceService } from './employee-self-service.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeSelfServiceController],
  providers: [EmployeeSelfServiceService],
  exports: [EmployeeSelfServiceService],
})
export class EmployeeSelfServiceModule {}
