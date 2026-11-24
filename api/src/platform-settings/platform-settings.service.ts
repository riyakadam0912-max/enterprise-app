import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth';
import { Role } from '../common/enums/role.enum';
import type { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

const DEFAULTS = {
  general: { platformName: 'Enterprise ERP', supportEmail: '', defaultTimezone: 'Asia/Kolkata', defaultCurrency: 'INR', defaultLocale: 'en-IN' },
  security: { minimumPasswordLength: 12, sessionTimeoutMinutes: 30, requireTwoFactor: false },
  notifications: { emailEnabled: true, smsEnabled: false, criticalAlertsEnabled: true },
  features: { maintenanceMode: false, allowOrganizationSignup: false },
};

type PlatformConfiguration = typeof DEFAULTS;

@Injectable()
export class PlatformSettingsService {
  private featureCache: { value: PlatformConfiguration['features']; expiresAt: number } | null = null;
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private assertPlatformAdmin(user: AuthUser) {
    const allowed = user.role === Role.SUPER_ADMIN || user.isSuperAdmin === true || user.isPlatformAdmin === true || user.roles?.includes(Role.SUPER_ADMIN);
    if (!allowed) throw new ForbiddenException('Platform administrator access is required');
  }

  private parse<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }

  async getSettings(user: AuthUser) {
    this.assertPlatformAdmin(user);
    const rows = await this.prisma.systemSetting.findMany({ where: { key: { startsWith: 'platform.' } } });
    const values = new Map(rows.map((row) => [row.key, row.value]));
    return {
      general: this.parse(values.get('platform.general'), DEFAULTS.general),
      security: this.parse(values.get('platform.security'), DEFAULTS.security),
      notifications: this.parse(values.get('platform.notifications'), DEFAULTS.notifications),
      features: this.parse(values.get('platform.features'), DEFAULTS.features),
      updatedAt: rows.reduce<Date | null>((latest, row) => !latest || row.updatedAt > latest ? row.updatedAt : latest, null),
    };
  }

  async updateSettings(dto: UpdatePlatformSettingsDto, user: AuthUser) {
    this.assertPlatformAdmin(user);
    const current = await this.getSettings(user);
    const next: PlatformConfiguration = {
      general: { ...current.general, ...dto.general },
      security: { ...current.security, ...dto.security },
      notifications: { ...current.notifications, ...dto.notifications },
      features: { ...current.features, ...dto.features },
    };
    await this.prisma.$transaction(async (tx) => {
      for (const category of Object.keys(next) as Array<keyof PlatformConfiguration>) {
        await tx.systemSetting.upsert({
          where: { key: `platform.${category}` },
          create: { key: `platform.${category}`, value: JSON.stringify(next[category]), description: `Platform ${category} configuration`, updatedBy: user.userId },
          update: { value: JSON.stringify(next[category]), updatedBy: user.userId },
        });
      }
      await tx.systemAuditEvent.create({ data: {
        reason: 'PLATFORM_SETTING_UPDATED', module: 'Platform Settings', entityType: 'SystemSetting', action: 'UPDATE',
        userId: user.userId, userName: user.name, userRole: user.role, oldValue: current as unknown as Prisma.InputJsonValue,
        newValue: next as unknown as Prisma.InputJsonValue, description: 'Platform configuration updated', status: 'SUCCESS',
      } });
    });
    this.featureCache = null;
    return this.getSettings(user);
  }

  async getRuntimeFeatures() {
    if (this.featureCache && this.featureCache.expiresAt > Date.now()) return this.featureCache.value;
    const row = await this.prisma.systemSetting.findUnique({ where: { key: 'platform.features' } });
    const value = this.parse(row?.value, DEFAULTS.features);
    this.featureCache = { value, expiresAt: Date.now() + 30_000 };
    return value;
  }

  getCapabilities(user: AuthUser) {
    this.assertPlatformAdmin(user);
    const emailProvider = (this.config.get<string>('EMAIL_PROVIDER') ?? 'NONE').toUpperCase();
    const storageProvider = (this.config.get<string>('FILE_STORAGE_PROVIDER') ?? 'local').toUpperCase();
    const redisEnabled = this.config.get<boolean>('REDIS_ENABLED') ?? false;
    const queueEnabled = this.config.get<boolean>('REDIS_QUEUE_ENABLED') ?? false;
    const websocketEnabled = this.config.get<boolean>('WEBSOCKET_ENABLED') ?? false;
    const serverless = (this.config.get<string>('VERCEL') ?? process.env.VERCEL) === '1';
    return {
      deployment: { mode: serverless ? 'serverless' : 'persistent', environment: this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? 'development' },
      email: { configured: emailProvider !== 'NONE', provider: emailProvider },
      storage: { configured: storageProvider !== 'LOCAL' || (process.env.NODE_ENV ?? '') !== 'production', provider: storageProvider },
      redis: { configured: redisEnabled },
      queues: { enabled: queueEnabled },
      websockets: { enabled: websocketEnabled, reason: websocketEnabled ? null : serverless ? 'Disabled on serverless deployment' : 'Disabled by configuration' },
    };
  }

  async getHistory(user: AuthUser) {
    this.assertPlatformAdmin(user);
    return this.prisma.systemAuditEvent.findMany({ where: { module: 'Platform Settings' }, orderBy: { createdAt: 'desc' }, take: 20 });
  }
}
