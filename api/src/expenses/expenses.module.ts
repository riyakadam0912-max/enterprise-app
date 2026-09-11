import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { BusinessUnitsModule } from '../business-units/business-units.module';
import { FileManagementModule } from '../file-management/file-management.module';

@Module({
  imports: [PrismaModule, WorkflowModule, BusinessUnitsModule, FileManagementModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
