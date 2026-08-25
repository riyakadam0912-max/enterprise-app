import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayslipGenerationService } from './payslip-generation.service';
import { BusinessUnitsModule } from '../business-units/business-units.module';

@Module({
  imports: [PrismaModule, BusinessUnitsModule],
  controllers: [PayrollController],
  providers: [
    PayrollService,
    PayrollCalculationService,
    PayslipGenerationService,
  ],
})
export class PayrollModule {}
