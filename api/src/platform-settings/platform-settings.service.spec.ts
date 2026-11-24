import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { PlatformSettingsService } from './platform-settings.service';

describe('PlatformSettingsService', () => {
  const user = { userId: 1, name: 'Platform Admin', role: Role.SUPER_ADMIN, roles: [Role.SUPER_ADMIN], isSuperAdmin: true } as any;
  let rows: any[];
  let prisma: any;
  let service: PlatformSettingsService;

  beforeEach(() => {
    rows = [];
    const tx = {
      systemSetting: {
        upsert: jest.fn(async ({ where, create, update }) => {
          const existing = rows.find((row) => row.key === where.key);
          if (existing) Object.assign(existing, update, { updatedAt: new Date() });
          else rows.push({ ...create, createdAt: new Date(), updatedAt: new Date() });
        }),
      },
      systemAuditEvent: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    prisma = {
      systemSetting: { findMany: jest.fn(async () => rows) },
      systemAuditEvent: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (work) => work(tx)),
      tx,
    };
    const config = new ConfigService({ EMAIL_PROVIDER: 'RESEND', FILE_STORAGE_PROVIDER: 's3', REDIS_ENABLED: true, REDIS_QUEUE_ENABLED: false, WEBSOCKET_ENABLED: false, VERCEL: '1', NODE_ENV: 'production' });
    service = new PlatformSettingsService(prisma, config);
  });

  it('returns safe defaults before the first update', async () => {
    await expect(service.getSettings(user)).resolves.toMatchObject({ general: { platformName: 'Enterprise ERP', defaultCurrency: 'INR' }, features: { maintenanceMode: false } });
  });

  it('persists typed categories and records one audit event', async () => {
    const result = await service.updateSettings({ general: { platformName: 'Acme ERP' }, features: { maintenanceMode: true } }, user);
    expect(result.general.platformName).toBe('Acme ERP');
    expect(result.features.maintenanceMode).toBe(true);
    expect(prisma.tx.systemSetting.upsert).toHaveBeenCalledTimes(4);
    expect(prisma.tx.systemAuditEvent.create).toHaveBeenCalledTimes(1);
  });

  it('exposes capability state without credentials', () => {
    expect(service.getCapabilities(user)).toEqual(expect.objectContaining({ email: { configured: true, provider: 'RESEND' }, storage: { configured: true, provider: 'S3' }, deployment: { mode: 'serverless', environment: 'production' } }));
  });

  it('rejects tenant administrators even when generic permission guards bypass admins', async () => {
    await expect(service.getSettings({ ...user, role: Role.ADMIN, roles: [Role.ADMIN], isSuperAdmin: false, isPlatformAdmin: false })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
