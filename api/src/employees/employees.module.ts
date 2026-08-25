import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessUnitsModule } from '../business-units/business-units.module';

@Module({
  imports: [PrismaModule, BusinessUnitsModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
})
export class EmployeesModule {}
