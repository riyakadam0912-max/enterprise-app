import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockPrismaService,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateProjectLinkDto } from './dto/create-project-link.dto';
import { BusinessUnitsService } from '../business-units/business-units.service';
import { OrganizationScopeService } from '../organizations/organization-scope.service';

// Helper to create valid mock AuthUser
function createMockAuthUser(
  role: Role,
  overrides: Partial<AuthUser> = {},
): AuthUser {
  return {
    id: 1,
    userId: 1,
    email: 'test@example.com',
    name: 'Test User',
    role,
    roles: [role],
    permissions: [],
    employeeId: role === Role.EMPLOYEE ? 101 : null,
    organizationId: 1,
    tokenType: 'Bearer',
    jti: null,
    ...overrides,
  };
}

// Type assertion to ensure mock Prisma delegates are not undefined and have Jest mock properties
function getPrismaDelegate(
  mockPrisma: ReturnType<typeof createMockPrismaService>,
  delegate: keyof PrismaService,
): DelegateMock {
  return mockPrisma[delegate] as unknown as DelegateMock;
}

describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  const mockAdminUser = createMockAuthUser(Role.ADMIN, { userId: 1 });
  const mockManagerUser = createMockAuthUser(Role.MANAGER, { userId: 2 });
  const mockEmployeeUser = createMockAuthUser(Role.EMPLOYEE, {
    userId: 3,
    employeeId: 101,
  });

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
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
            buildDirectBUWhere: jest.fn().mockReturnValue({}),
            buildEmployeeBUWhere: jest.fn().mockReturnValue({
              organizationId: 1,
              deletedAt: null,
            }),
            assertRecordAccessible: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: OrganizationScopeService,
          useValue: {
            getOrganizationIds: jest.fn().mockResolvedValue([1]),
            getRelatedOrganizationIds: jest.fn().mockResolvedValue([1]),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('preserves canonical project statuses instead of silently flattening them to ACTIVE', () => {
    // Legacy status mappings
    expect((service as any).normalizeProjectStatus('PLANNED')).toBe(
      'NOT_STARTED',
    );
    expect((service as any).normalizeProjectStatus('ACTIVE')).toBe(
      'IN_PROGRESS',
    );
    expect((service as any).normalizeProjectStatus('IN PROGRESS')).toBe(
      'IN_PROGRESS',
    );
    expect((service as any).normalizeProjectStatus('ON HOLD')).toBe(
      'BLOCKED_CANCELLED',
    );
    // New canonical statuses
    expect((service as any).normalizeProjectStatus('NOT_STARTED')).toBe(
      'NOT_STARTED',
    );
    expect((service as any).normalizeProjectStatus('IN_APPROVAL')).toBe(
      'IN_APPROVAL',
    );
    expect((service as any).normalizeProjectStatus('POSTPONED')).toBe(
      'POSTPONED',
    );
    expect((service as any).normalizeProjectStatus('COMPLETED')).toBe(
      'COMPLETED',
    );
  });

  describe('create', () => {
    const createProjectDto: CreateProjectDto = {
      projectName: 'Test Project',
      managerId: 2,
    };

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.create(
          createProjectDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if project name is missing', async () => {
      await expect(
        service.create({} as CreateProjectDto, mockAdminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create project successfully when manager is not provided (manager is now optional)', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.create.mockResolvedValueOnce({
        id: 1,
        projectName: 'Test Project',
        organizationId: mockAdminUser.organizationId,
      });

      const result = await service.create(
        { projectName: 'Test Project' } as CreateProjectDto,
        mockAdminUser,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException if manager not found', async () => {
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      userDelegate.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create(createProjectDto, mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if manager is not a MANAGER role', async () => {
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      userDelegate.findUnique.mockResolvedValueOnce({
        id: 2,
        name: 'Test Employee',
        role: Role.EMPLOYEE,
      });

      await expect(
        service.create(createProjectDto, mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create project successfully for admin', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      userDelegate.findUnique.mockResolvedValueOnce({
        id: 2,
        name: 'Test Manager',
        role: Role.MANAGER,
      });

      const expectedProject = {
        id: 1,
        projectName: 'Test Project',
        organizationId: 1,
        managerId: 2,
        manager: 'Test Manager',
      };

      projectDelegate.create.mockResolvedValueOnce(expectedProject);

      const result = await service.create(createProjectDto, mockAdminUser);

      expect(result).toEqual(expectedProject);
      expect(projectDelegate.create).toHaveBeenCalledTimes(1);
      expect(projectDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdById: mockAdminUser.userId,
            managerAssignedById: mockAdminUser.userId,
            owners: { connect: [{ id: mockAdminUser.userId }] },
          }),
        }),
      );
    });

    it('connects the creator and deduplicated additional owners on create', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      userDelegate.findMany.mockResolvedValueOnce([
        { id: 4, name: 'Additional Owner', role: Role.MANAGER },
      ]);
      projectDelegate.create.mockResolvedValueOnce({ id: 3 });

      await service.create(
        { projectName: 'Owned Project', ownerIds: [4, 4] } as CreateProjectDto,
        mockAdminUser,
      );

      expect(projectDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            owners: { connect: [{ id: 1 }, { id: 4 }] },
          }),
        }),
      );
    });

    it('should create project successfully for manager (auto-setting managerId)', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      userDelegate.findUnique.mockResolvedValueOnce({
        id: 2,
        name: 'Test Manager',
        role: Role.MANAGER,
      });

      const expectedProject = {
        id: 1,
        projectName: 'Test Project',
        organizationId: 1,
        managerId: 2,
        manager: 'Test Manager',
      };

      projectDelegate.create.mockResolvedValueOnce(expectedProject);

      const result = await service.create(
        { projectName: 'Test Project' } as CreateProjectDto,
        mockManagerUser,
      );

      expect(result).toEqual(expectedProject);
    });
  });

  describe('assignManager', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.assignManager(
          1,
          2,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if project not found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.assignManager(999, 2, mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if new manager not found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      projectDelegate.findUnique.mockResolvedValueOnce({ id: 1 });
      userDelegate.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.assignManager(1, 999, mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should assign manager successfully', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      projectDelegate.findUnique.mockResolvedValueOnce({ id: 1 });
      userDelegate.findUnique.mockResolvedValueOnce({
        id: 3,
        name: 'New Manager',
        role: Role.MANAGER,
      });
      projectDelegate.update.mockResolvedValueOnce({
        id: 1,
        managerId: 3,
        manager: 'New Manager',
      });

      const result = await service.assignManager(1, 3, mockAdminUser);
      expect(result.managerId).toEqual(3);
      expect(projectDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            managerId: 3,
            managerAssignedById: mockAdminUser.userId,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all projects for admin', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const mockProjects = [
        { id: 1, projectName: 'Project 1' },
        { id: 2, projectName: 'Project 2' },
      ];

      projectDelegate.findMany.mockResolvedValueOnce(mockProjects);

      const result = await service.findAll(mockAdminUser);
      expect(result).toEqual(mockProjects);
    });

    it('should return projects for a global super admin without an organization', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const mockProjects = [{ id: 1, projectName: 'Cross-org Project' }];
      const globalSuperAdmin = createMockAuthUser(Role.SUPER_ADMIN, {
        organizationId: null,
      });

      projectDelegate.findMany.mockResolvedValueOnce(mockProjects);

      const result = await service.findAll(globalSuperAdmin);

      expect(result).toEqual(mockProjects);
      expect(projectDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });

    it('should resolve project membership from the linked employee when User.employeeId is missing', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      userDelegate.findUnique.mockResolvedValueOnce({
        id: 3,
        role: Role.EMPLOYEE,
        managerId: null,
        employeeId: null,
      });
      employeeDelegate.findFirst.mockResolvedValueOnce({ id: 101 });
      projectDelegate.findMany.mockResolvedValueOnce([]);
      jest
        .spyOn((service as any).businessUnitsService, 'buildDirectBUWhere')
        .mockReturnValue({
          organizationId: 1,
          businessUnitId: { in: [10] },
        });

      await service.findAll(mockEmployeeUser);

      expect(projectDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { assignedEmployees: { some: { id: 101 } } },
                ]),
              }),
            ]),
          }),
        }),
      );
    });

    it("should include projects owned by the employee's reporting manager", async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      userDelegate.findUnique.mockResolvedValueOnce({
        id: mockEmployeeUser.userId,
        role: Role.EMPLOYEE,
        managerId: 2,
        employeeId: mockEmployeeUser.employeeId,
      });
      projectDelegate.findMany.mockResolvedValueOnce([]);
      jest
        .spyOn((service as any).businessUnitsService, 'buildDirectBUWhere')
        .mockReturnValue({
          organizationId: 1,
          businessUnitId: { in: [10] },
        });

      await service.findAll(mockEmployeeUser);

      expect(projectDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  {
                    managerUser: {
                      teamMembers: { some: { id: mockEmployeeUser.userId } },
                    },
                  },
                  {
                    managerUser: {
                      reportingEmployees: {
                        some: { employeeId: mockEmployeeUser.userId },
                      },
                    },
                  },
                ]),
              }),
              expect.objectContaining({
                OR: expect.arrayContaining([
                  {
                    OR: [
                      {
                        managerUser: {
                          teamMembers: {
                            some: { id: mockEmployeeUser.userId },
                          },
                        },
                      },
                      {
                        managerUser: {
                          reportingEmployees: {
                            some: { employeeId: mockEmployeeUser.userId },
                          },
                        },
                      },
                    ],
                  },
                  {
                    organizationId: 1,
                    businessUnitId: { in: [10] },
                  },
                ]),
              }),
            ]),
          }),
        }),
      );
    });

    it('should include directly assigned manager projects outside the active BU scope', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findMany.mockResolvedValueOnce([]);
      jest
        .spyOn((service as any).businessUnitsService, 'buildDirectBUWhere')
        .mockReturnValue({
          organizationId: 1,
          businessUnitId: -1,
        });

      await service.findAll(mockManagerUser);

      expect(projectDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { organizationId: { in: [1] }, deletedAt: null },
              {
                OR: [
                  { managerId: mockManagerUser.userId },
                  { coManagers: { some: { id: mockManagerUser.userId } } },
                  { organizationId: 1, businessUnitId: -1 },
                ],
              },
            ],
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.findOne(
          1,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user has no access to project', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(999, mockManagerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if project not found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectDelegate.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne(1, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return project with tasks and team members if found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      const mockProject = {
        id: 1,
        projectName: 'Test Project',
        status: 'ACTIVE',
        managerId: 2,
      };

      const mockTasks = [
        { id: 1, taskName: 'Task 1', projectId: 1 },
        { id: 2, taskName: 'Task 2', projectId: 1 },
      ];

      const mockTeamMembers = [
        { id: 3, name: 'Employee 1', role: Role.EMPLOYEE },
      ];

      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectDelegate.findUnique.mockResolvedValueOnce(mockProject);
      taskDelegate.findMany.mockResolvedValueOnce(mockTasks);
      userDelegate.findMany.mockResolvedValueOnce(mockTeamMembers);

      const result = await service.findOne(1, mockAdminUser);
      // Status is normalized when retrieved
      const normalizedStatus = (service as any).normalizeProjectStatus(
        mockProject.status,
      );
      expect(result).toEqual({
        ...mockProject,
        status: normalizedStatus,
        tasks: mockTasks,
        teamMembers: mockTeamMembers,
      });
    });
  });

  describe('addCoManager', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.addCoManager(
          1,
          3,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if project not found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findUnique.mockResolvedValueOnce(null);

      await expect(service.addCoManager(999, 3, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not admin or primary manager', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        managerId: 999,
      });
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(service.addCoManager(1, 3, mockManagerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if trying to add primary manager as co-manager', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        managerId: 2,
      });

      await expect(service.addCoManager(1, 2, mockAdminUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return project without changes if co-manager already assigned', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');

      const mockProject = {
        id: 1,
        organizationId: 1,
        managerId: 2,
        coManagers: [{ id: 3 }],
      };

      projectDelegate.findFirst.mockResolvedValueOnce(mockProject);
      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectDelegate.findUnique.mockResolvedValueOnce(mockProject);

      await service.addCoManager(1, 3, mockAdminUser);
      expect(projectDelegate.update).not.toHaveBeenCalled();
    });

    it('should add co-manager successfully', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        managerId: 2,
      });
      userDelegate.findUnique.mockResolvedValueOnce({
        id: 3,
        name: 'Co-Manager',
        role: Role.MANAGER,
      });
      projectDelegate.update.mockResolvedValueOnce({
        id: 1,
        managerId: 2,
        coManagers: [{ id: 3, name: 'Co-Manager' }],
      });

      const _result = await service.addCoManager(1, 3, mockAdminUser);
      expect(projectDelegate.update).toHaveBeenCalledTimes(1);
    });

    it('allows a parent admin to add a co-manager from an authorized descendant organization', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const organizationScope = (service as any).organizationScopeService;
      jest
        .spyOn(organizationScope, 'getOrganizationIds')
        .mockResolvedValue([1, 2]);
      jest
        .spyOn(organizationScope, 'getRelatedOrganizationIds')
        .mockResolvedValue([1, 2]);
      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 5,
        organizationId: 1,
        managerId: 2,
        coManagers: [],
      });
      userDelegate.findFirst.mockResolvedValueOnce({
        id: 22,
        name: 'Child Manager',
        role: Role.MANAGER,
      });
      projectDelegate.update.mockResolvedValueOnce({ id: 5 });

      await service.addCoManager(5, 22, mockAdminUser);

      expect(userDelegate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: { in: [1, 2] },
          }),
        }),
      );
      expect(projectDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5, organizationId: 1 },
          data: { coManagers: { connect: { id: 22 } } },
        }),
      );
    });
  });

  describe('removeCoManager', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.removeCoManager(
          1,
          3,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if project not found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.removeCoManager(999, 3, mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not admin or primary manager', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        managerId: 999,
      });
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.removeCoManager(1, 3, mockManagerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if trying to remove primary manager', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        managerId: 2,
      });

      await expect(
        service.removeCoManager(1, 2, mockAdminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should remove co-manager successfully', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        managerId: 2,
      });
      userDelegate.findUnique.mockResolvedValueOnce({
        id: 3,
        role: Role.MANAGER,
      });
      projectDelegate.update.mockResolvedValueOnce({ id: 1 });

      await service.removeCoManager(1, 3, mockAdminUser);
      expect(projectDelegate.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('assignEmployee', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.assignEmployee(
          1,
          101,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user cannot manage project', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.assignEmployee(1, 101, mockManagerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if project not found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectDelegate.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.assignEmployee(1, 101, mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if employee not found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');

      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        assignedEmployees: [],
      });
      employeeDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.assignEmployee(1, 999, mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return project without changes if employee already assigned', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        assignedEmployees: [{ id: 101 }],
        managerId: 2,
      });
      employeeDelegate.findFirst.mockResolvedValueOnce({ id: 101 });
      // Mocks for findOne which is called internally
      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectDelegate.findUnique.mockResolvedValueOnce({ id: 1, managerId: 2 });
      taskDelegate.findMany.mockResolvedValueOnce([]);
      userDelegate.findMany.mockResolvedValueOnce([]);

      await service.assignEmployee(1, 101, mockAdminUser);
      expect(projectDelegate.update).not.toHaveBeenCalled();
    });

    it('should assign employee successfully', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');

      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        assignedEmployees: [],
      });
      employeeDelegate.findFirst.mockResolvedValueOnce({ id: 101 });
      projectDelegate.update.mockResolvedValueOnce({
        id: 1,
        assignedEmployees: [{ id: 101 }],
      });

      await service.assignEmployee(1, 101, mockAdminUser);
      expect(projectDelegate.update).toHaveBeenCalledTimes(1);
    });

    it('allows a parent admin to assign a child employee and records the admin as an owner', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const organizationScope = (service as any).organizationScopeService;
      jest
        .spyOn(organizationScope, 'getOrganizationIds')
        .mockResolvedValue([1, 2]);
      jest
        .spyOn(organizationScope, 'getRelatedOrganizationIds')
        .mockResolvedValue([1, 2]);
      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 5,
        organizationId: 1,
        assignedEmployees: [],
      });
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 101,
        organizationId: 2,
        name: 'Child Employee',
        user: { id: 8 },
      });
      projectDelegate.update.mockResolvedValueOnce({ id: 5 });

      await service.assignEmployee(5, 101, mockAdminUser);

      expect(employeeDelegate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                organizationId: 1,
                id: 101,
              }),
              expect.objectContaining({
                id: 101,
                organizationId: { in: [2] },
              }),
            ]),
          }),
        }),
      );
      expect(projectDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedEmployees: { connect: { id: 101 } },
            owners: { connect: { id: mockAdminUser.userId } },
          }),
        }),
      );
    });

    it('allows an organization-scoped super admin to assign a descendant employee', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const organizationScope = (service as any).organizationScopeService;
      jest
        .spyOn(organizationScope, 'getOrganizationIds')
        .mockResolvedValue([1, 2]);
      jest
        .spyOn(organizationScope, 'getRelatedOrganizationIds')
        .mockResolvedValue([1, 2]);
      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 8,
        organizationId: 1,
        assignedEmployees: [],
      });
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 101,
        organizationId: 2,
        name: 'Child Employee',
        user: { id: 8 },
      });
      projectDelegate.update.mockResolvedValueOnce({ id: 8 });

      const superAdmin = createMockAuthUser(Role.SUPER_ADMIN, {
        userId: 10,
        organizationId: 1,
      });
      await service.assignEmployee(8, 101, superAdmin);

      expect(employeeDelegate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                organizationId: 1,
                id: 101,
              }),
              expect.objectContaining({
                id: 101,
                organizationId: { in: [2] },
              }),
            ]),
          }),
        }),
      );
      expect(projectDelegate.update).toHaveBeenCalled();
    });

    it('does not allow assigning an employee outside the requester organization scope', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const organizationScope = (service as any).organizationScopeService;
      jest
        .spyOn(organizationScope, 'getOrganizationIds')
        .mockResolvedValue([1, 2]);
      jest
        .spyOn(organizationScope, 'getRelatedOrganizationIds')
        .mockResolvedValue([1, 2, 3]);
      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 8,
        organizationId: 1,
        assignedEmployees: [],
      });
      employeeDelegate.findFirst.mockResolvedValueOnce(null);

      const admin = createMockAuthUser(Role.ADMIN, { organizationId: 1 });
      await expect(service.assignEmployee(8, 303, admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(employeeDelegate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                id: 303,
                organizationId: 1,
              }),
              expect.objectContaining({
                id: 303,
                organizationId: { in: [2] },
              }),
            ]),
          }),
        }),
      );
      expect(projectDelegate.update).not.toHaveBeenCalled();
    });

    it('does not allow assigning a same-organization employee outside the active business unit', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const businessUnits = (service as any).businessUnitsService;
      jest.spyOn(businessUnits, 'resolveScope').mockResolvedValue({
        organizationId: 1,
        allUnits: false,
        unitIds: [10],
        assignedUnitId: 10,
      });
      jest.spyOn(businessUnits, 'buildEmployeeBUWhere').mockReturnValue({
        organizationId: 1,
        businessUnitId: { in: [10] },
        deletedAt: null,
      });
      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 8,
        organizationId: 1,
        assignedEmployees: [],
      });
      employeeDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.assignEmployee(8, 110, mockAdminUser),
      ).rejects.toThrow(NotFoundException);
      expect(employeeDelegate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                id: 110,
                organizationId: 1,
                businessUnitId: { in: [10] },
              }),
            ]),
          }),
        }),
      );
      expect(projectDelegate.update).not.toHaveBeenCalled();
    });
  });

  describe('removeEmployee', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.removeEmployee(
          1,
          101,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user cannot manage project', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.removeEmployee(1, 101, mockManagerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if employee not found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');

      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      employeeDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.removeEmployee(1, 999, mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should remove employee successfully', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');

      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      employeeDelegate.findFirst.mockResolvedValueOnce({ id: 101 });
      projectDelegate.update.mockResolvedValueOnce({ id: 1 });

      await service.removeEmployee(1, 101, mockAdminUser);
      expect(projectDelegate.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    const updateProjectDto: UpdateProjectDto = {
      projectName: 'Updated Project',
    };

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.update(
          1,
          updateProjectDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user cannot manage project', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update(1, updateProjectDto, mockManagerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update project successfully', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');

      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectDelegate.update.mockResolvedValueOnce({
        id: 1,
        projectName: 'Updated Project',
      });

      const result = await service.update(1, updateProjectDto, mockAdminUser);
      expect(result.projectName).toEqual('Updated Project');
    });

    it('replaces additional owners while retaining the project creator', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      projectDelegate.findUnique.mockResolvedValueOnce({ createdById: 1 });
      userDelegate.findMany.mockResolvedValueOnce([
        { id: 4, name: 'Additional Owner', role: Role.MANAGER },
      ]);
      projectDelegate.update.mockResolvedValueOnce({ id: 1 });

      await service.update(
        1,
        { ownerIds: [4] } as UpdateProjectDto,
        mockAdminUser,
      );

      expect(projectDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            owners: { set: [{ id: 1 }, { id: 4 }] },
          }),
        }),
      );
    });

    it('should update managerId and manager name if managerId provided', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      userDelegate.findUnique.mockResolvedValueOnce({
        id: 3,
        name: 'New Manager',
        role: Role.MANAGER,
      });
      projectDelegate.update.mockResolvedValueOnce({
        id: 1,
        managerId: 3,
        manager: 'New Manager',
      });

      const result = await service.update(
        1,
        { managerId: 3 } as UpdateProjectDto,
        mockAdminUser,
      );
      expect(result.managerId).toEqual(3);
      expect(projectDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            managerAssignedById: mockAdminUser.userId,
          }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.updateStatus(
          1,
          'COMPLETED',
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user cannot manage project', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateStatus(1, 'COMPLETED', mockManagerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update status successfully (normalize status)', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');

      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectDelegate.update.mockResolvedValueOnce({
        id: 1,
        status: 'ACTIVE',
      });

      const result = await service.updateStatus(
        1,
        'IN PROGRESS',
        mockAdminUser,
      );
      expect(result.status).toEqual('ACTIVE');
    });
  });

  describe('remove', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.remove(
          1,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user cannot manage project', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(service.remove(1, mockManagerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should soft delete project successfully', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');

      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectDelegate.update.mockResolvedValueOnce({
        id: 1,
        deletedAt: new Date(),
      });

      await service.remove(1, mockAdminUser);
      expect(projectDelegate.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('importRecords', () => {
    it('should import valid records and skip invalid ones', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      const records = [
        { projectName: 'Valid Project', managerId: 2 },
        { invalid: 'data' },
      ];

      userDelegate.findUnique.mockResolvedValueOnce({
        id: 2,
        name: 'Test Manager',
        role: Role.MANAGER,
      });
      projectDelegate.create.mockResolvedValueOnce({ id: 1 });

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
      expect(projectDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            managerAssignedById: mockAdminUser.userId,
          }),
        }),
      );
    });
  });

  describe('getByStatus', () => {
    it('should throw ForbiddenException if user is not admin or manager', async () => {
      await expect(service.getByStatus(mockEmployeeUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should preserve real project status groupings without flattening legacy values', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findMany.mockResolvedValueOnce([
        { id: 1, status: 'IN_PROGRESS' },
        { id: 2, status: 'COMPLETED' },
        { id: 3, status: 'NOT_STARTED' },
      ]);

      const result = await service.getByStatus(mockAdminUser);
      expect(result.IN_PROGRESS).toHaveLength(1);
      expect(result.COMPLETED).toHaveLength(1);
      expect(result.NOT_STARTED).toHaveLength(1);
    });
  });

  describe('getLinks', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.getLinks(
          1,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user has no access to project', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(service.getLinks(999, mockManagerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return project links', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const projectLinkDelegate = getPrismaDelegate(mockPrisma, 'projectLink');

      const mockLinks = [
        { id: 1, title: 'Link 1', url: 'https://example.com' },
      ];

      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectLinkDelegate.findMany.mockResolvedValueOnce(mockLinks);

      const result = await service.getLinks(1, mockAdminUser);
      expect(result).toEqual(mockLinks);
    });
  });

  describe('createLink', () => {
    const createProjectLinkDto: CreateProjectLinkDto = {
      title: 'Test Link',
      url: 'https://example.com',
    };

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.createLink(
          1,
          createProjectLinkDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user cannot manage project', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.createLink(1, createProjectLinkDto, mockManagerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create project link successfully', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const projectLinkDelegate = getPrismaDelegate(mockPrisma, 'projectLink');

      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectDelegate.findUnique.mockResolvedValueOnce({ id: 1 });
      projectLinkDelegate.create.mockResolvedValueOnce({
        id: 1,
        title: 'Test Link',
        url: 'https://example.com',
      });

      const result = await service.createLink(
        1,
        createProjectLinkDto,
        mockAdminUser,
      );
      expect(result).toEqual({
        id: 1,
        title: 'Test Link',
        url: 'https://example.com',
      });
    });
  });

  describe('removeLink', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.removeLink(
          1,
          1,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user cannot manage project', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(service.removeLink(1, 1, mockManagerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if link not found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const projectLinkDelegate = getPrismaDelegate(mockPrisma, 'projectLink');

      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectLinkDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(service.removeLink(1, 999, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should soft delete project link successfully', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const projectLinkDelegate = getPrismaDelegate(mockPrisma, 'projectLink');

      projectDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      projectLinkDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        projectId: 1,
      });
      projectLinkDelegate.update.mockResolvedValueOnce({
        id: 1,
        deletedAt: new Date(),
      });

      await service.removeLink(1, 1, mockAdminUser);
      expect(projectLinkDelegate.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProgress', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.getProgress(
          1,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user cannot manage project', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(service.getProgress(1, mockManagerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if project not found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(service.getProgress(1, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return progress data', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');

      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        projectName: 'Test Project',
        status: 'ACTIVE',
      });
      taskDelegate.findMany.mockResolvedValueOnce([
        { id: 1, status: 'PENDING' },
        { id: 2, status: 'APPROVED' },
        { id: 3, status: 'APPROVED' },
      ]);

      const result = await service.getProgress(1, mockAdminUser);
      expect(result.progressPercent).toEqual(67);
      expect(result.byStatus.APPROVED).toEqual(2);
    });

    it('loads progress tasks from an authorized related organization', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      const organizationScope = (service as any).organizationScopeService;
      jest
        .spyOn(organizationScope, 'getRelatedOrganizationIds')
        .mockResolvedValue([1, 2]);
      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 7,
        organizationId: 2,
        projectName: 'Related Organization Project',
        status: 'IN_PROGRESS',
      });
      taskDelegate.findMany.mockResolvedValueOnce([
        { id: 1, status: 'APPROVED' },
      ]);

      const result = await service.getProgress(7, mockAdminUser);

      expect(result.completedTasks).toBe(1);
      expect(taskDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 7, organizationId: 2 },
        }),
      );
    });
  });
});
