import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { BusinessUnitsModule } from '../business-units/business-units.module';

@Module({
  imports: [PrismaModule, WorkflowModule, BusinessUnitsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
