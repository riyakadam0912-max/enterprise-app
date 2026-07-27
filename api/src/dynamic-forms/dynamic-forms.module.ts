import { Module } from '@nestjs/common';
import { DynamicFormsService } from './dynamic-forms.service';
import { DynamicFormsController } from './dynamic-forms.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DynamicFormsController],
  providers: [DynamicFormsService],
})
export class DynamicFormsModule {}
