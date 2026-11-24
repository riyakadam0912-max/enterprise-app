import { ServiceUnavailableException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { MaintenanceModeMiddleware } from './maintenance-mode.middleware';

describe('MaintenanceModeMiddleware', () => {
  const next = jest.fn();
  const response = {} as any;

  beforeEach(() => next.mockReset());

  it('allows normal traffic when maintenance mode is disabled', async () => {
    const middleware = new MaintenanceModeMiddleware({ getRuntimeFeatures: jest.fn().mockResolvedValue({ maintenanceMode: false }) } as any);
    await middleware.use({ path: '/api/v1/employees' } as any, response, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks ordinary traffic while allowing platform administrators', async () => {
    const middleware = new MaintenanceModeMiddleware({ getRuntimeFeatures: jest.fn().mockResolvedValue({ maintenanceMode: true }) } as any);
    await expect(middleware.use({ path: '/api/v1/employees' } as any, response, next)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await middleware.use({ path: '/api/v1/employees', user: { role: Role.SUPER_ADMIN } } as any, response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('always preserves authentication and settings recovery routes', async () => {
    const settings = { getRuntimeFeatures: jest.fn() };
    const middleware = new MaintenanceModeMiddleware(settings as any);
    await middleware.use({ path: '/api/v1/auth/login' } as any, response, next);
    await middleware.use({ path: '/api/v1/platform-settings' } as any, response, next);
    expect(settings.getRuntimeFeatures).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(2);
  });
});
