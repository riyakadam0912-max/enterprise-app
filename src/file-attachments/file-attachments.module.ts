import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FileAttachmentsService } from './file-attachments.service';
import { FileAttachmentsController } from './file-attachments.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, MulterModule.register({ dest: './uploads' })],
  controllers: [FileAttachmentsController],
  providers: [FileAttachmentsService],
  exports: [FileAttachmentsService],
})
export class FileAttachmentsModule {}
