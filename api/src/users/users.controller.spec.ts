import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import {
  createMockAuditLogsService,
  createMockPrismaService,
} from '../../test/helpers/mocks.helper';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

describe('UsersController', () => {
  let controller: UsersController;
  const mockPrisma = createMockPrismaService();
  let reflector: Reflector;

  beforeEach(async () => {
    reflector = new Reflector();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: { sendEmail: jest.fn() } },
        {
          provide: AuditLogsService,
          useValue: createMockAuditLogsService(),
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('restricts user listing to admins only', () => {
    const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      UsersController.prototype.findAll,
      UsersController,
    ]);

    expect(roles).toEqual([
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.COMPLIANCE_MANAGER,
      Role.HR,
    ]);
  });

  it('restricts assignable-user lookup to privileged roles only', () => {
    const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      UsersController.prototype.findAssignable,
      UsersController,
    ]);

    expect(roles).toEqual([Role.ADMIN, Role.HR, Role.MANAGER]);
  });
});
