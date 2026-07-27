import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FILE_STORAGE_PROVIDER } from './file-management.constants';
import { FileManagementController } from './file-management.controller';
import { FileManagementService } from './file-management.service';
import { FileAccessGuard } from './guards/file-access.guard';
import { CloudinaryStorageProvider } from './storage/cloudinary-storage.provider';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { S3StorageProvider } from './storage/s3-storage.provider';

@Module({
  imports: [ConfigModule, PrismaModule, AuditLogsModule],
  controllers: [FileManagementController],
  providers: [
    FileManagementService,
    FileAccessGuard,
    LocalStorageProvider,
    S3StorageProvider,
    CloudinaryStorageProvider,
    {
      provide: FILE_STORAGE_PROVIDER,
      inject: [
        ConfigService,
        LocalStorageProvider,
        S3StorageProvider,
        CloudinaryStorageProvider,
      ],
      useFactory: (
        configService: ConfigService,
        localStorageProvider: LocalStorageProvider,
        s3StorageProvider: S3StorageProvider,
        cloudinaryStorageProvider: CloudinaryStorageProvider,
      ) => {
        const provider = (
          configService.get<string>('FILE_STORAGE_PROVIDER') ?? 'local'
        ).toLowerCase();
        if (provider === 's3') return s3StorageProvider;
        if (provider === 'cloudinary') return cloudinaryStorageProvider;
        return localStorageProvider;
      },
    },
  ],
  exports: [FileManagementService, FILE_STORAGE_PROVIDER],
})
export class FileManagementModule {}
