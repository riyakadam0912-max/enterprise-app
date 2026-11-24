import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformSettingsService } from './platform-settings.service';
import { MaintenanceModeMiddleware } from './maintenance-mode.middleware';

@Module({ imports: [PrismaModule], controllers: [PlatformSettingsController], providers: [PlatformSettingsService, MaintenanceModeMiddleware], exports: [PlatformSettingsService, MaintenanceModeMiddleware] })
export class PlatformSettingsModule {}
