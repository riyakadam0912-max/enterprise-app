import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from './roles.guard';
import { Permission } from '../enums/permissions.enum';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { LeadsController } from '../../leads/leads.controller';
import { DealsController } from '../../deals/deals.controller';
import { QuotesController } from '../../quotes/quotes.controller';

function contextWithUser(user?: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('authorization guards', () => {
  it('fails closed when a role-protected route has no user', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(contextWithUser())).toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed when a permission-protected route has no user', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permission.USER_READ]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() => guard.canActivate(contextWithUser())).toThrow(
      UnauthorizedException,
    );
  });

  it('still rejects authenticated users without the required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(contextWithUser({ role: Role.EMPLOYEE, roles: [] })),
    ).toThrow(ForbiddenException);
  });

  it('accepts case-insensitive role values from the request user', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(contextWithUser({ role: 'admin', roles: ['admin'] })),
    ).not.toThrow();
  });

  it('allows managers to read CRM records on the same controller paths as the service logic', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, LeadsController.prototype.findAll),
    ).toEqual(expect.arrayContaining([Role.MANAGER]));
    expect(
      Reflect.getMetadata(ROLES_KEY, DealsController.prototype.findAll),
    ).toEqual(expect.arrayContaining([Role.MANAGER]));
    expect(
      Reflect.getMetadata(ROLES_KEY, QuotesController.prototype.findAll),
    ).toEqual(expect.arrayContaining([Role.MANAGER]));
  });
});
