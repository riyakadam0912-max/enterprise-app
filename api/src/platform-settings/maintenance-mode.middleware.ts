import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PlatformSettingsService } from './platform-settings.service';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';

@Injectable()
export class MaintenanceModeMiddleware {
  constructor(private readonly settings: PlatformSettingsService) {}

  async use(req: Request & { user?: AuthUser }, _res: Response, next: NextFunction) {
    const path = req.path ?? req.url;
    if (/\/(health|auth|platform-settings)(\/|$)/.test(path)) return next();
    const features = await this.settings.getRuntimeFeatures();
    if (!features.maintenanceMode) return next();
    const user = req.user;
    const platformAdmin = user?.role === Role.SUPER_ADMIN || user?.isSuperAdmin === true || user?.isPlatformAdmin === true || user?.roles?.includes(Role.SUPER_ADMIN);
    if (platformAdmin) return next();
    throw new ServiceUnavailableException('The platform is temporarily in maintenance mode');
  }
}
