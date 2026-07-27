import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FileAttachmentsService } from './file-attachments.service';
import { FileAttachmentsController } from './file-attachments.controller';
import { FILE_ATTACHMENT_UPLOAD_ROOT } from './file-attachments.constants';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({ dest: FILE_ATTACHMENT_UPLOAD_ROOT }),
  ],
  controllers: [FileAttachmentsController],
  providers: [FileAttachmentsService],
  exports: [FileAttachmentsService],
})
export class FileAttachmentsModule {}
