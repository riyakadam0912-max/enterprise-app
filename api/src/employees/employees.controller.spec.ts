import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BusinessUnitsService } from '../business-units/business-units.service';
import { createMockPrismaService } from '../../test/helpers/mocks.helper';

describe('EmployeesController', () => {
  let controller: EmployeesController;
  const mockPrisma = createMockPrismaService();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: BusinessUnitsService,
          useValue: {
            resolveScope: jest.fn().mockResolvedValue({
              organizationId: 1,
              allUnits: true,
              unitIds: [],
              assignedUnitId: null,
            }),
            buildEmployeeBUWhere: jest.fn().mockReturnValue({}),
          },
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

    controller = module.get<EmployeesController>(EmployeesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
