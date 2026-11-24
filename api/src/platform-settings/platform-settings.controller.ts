import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permissions.enum';
import type { AuthenticatedRequest } from '../common/types/request';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { PlatformSettingsService } from './platform-settings.service';

@ApiTags('System - Platform Settings')
@ApiBearerAuth()
@Controller('platform-settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlatformSettingsController {
  constructor(private readonly service: PlatformSettingsService) {}
  @Get() @RequirePermissions(Permission.PLATFORM_SETTINGS_READ) get(@Req() req: AuthenticatedRequest) { return this.service.getSettings(req.user); }
  @Patch() @RequirePermissions(Permission.PLATFORM_SETTINGS_UPDATE) update(@Body() dto: UpdatePlatformSettingsDto, @Req() req: AuthenticatedRequest) { return this.service.updateSettings(dto, req.user); }
  @Get('capabilities') @RequirePermissions(Permission.PLATFORM_SETTINGS_READ) capabilities(@Req() req: AuthenticatedRequest) { return this.service.getCapabilities(req.user); }
  @Get('history') @RequirePermissions(Permission.PLATFORM_SETTINGS_READ) history(@Req() req: AuthenticatedRequest) { return this.service.getHistory(req.user); }
}
