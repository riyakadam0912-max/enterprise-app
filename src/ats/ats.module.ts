import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AtsController } from './ats.controller';
import { AtsService } from './ats.service';

@Module({
  imports: [PrismaModule],
  controllers: [AtsController],
  providers: [AtsService],
})
export class AtsModule {}
