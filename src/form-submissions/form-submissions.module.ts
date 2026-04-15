import { Module } from '@nestjs/common';
import { FormSubmissionsService } from './form-submissions.service';
import { FormSubmissionsController } from './form-submissions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [FormSubmissionsController],
  providers:   [FormSubmissionsService],
})
export class FormSubmissionsModule {}
