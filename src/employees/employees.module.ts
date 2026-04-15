import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { PrismaModule } from '../prisma/prisma.module'; // 👈 IMPORTANT

@Module({
  imports: [PrismaModule], // 👈 ADD THIS
  controllers: [EmployeesController],
  providers: [EmployeesService],
})
export class EmployeesModule {}