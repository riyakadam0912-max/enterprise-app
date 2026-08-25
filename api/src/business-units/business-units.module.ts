import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessUnitsController } from './business-units.controller';
import { BusinessUnitsService } from './business-units.service';

@Module({
  imports: [PrismaModule],
  controllers: [BusinessUnitsController],
  providers: [BusinessUnitsService],
  exports: [BusinessUnitsService],
})
export class BusinessUnitsModule {}
