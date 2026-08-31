import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AuthUser } from '../common/types/auth';
import { Role } from '../common/enums/role.enum';
import { hashPassword } from '../users/utils/hash-password';
import { BusinessUnitsService } from '../business-units/business-units.service';

const ALLOWED_DEPARTMENTS = [
  'Sales',
  'Operations',
  'Marketing',
  'HR',
  'Finance',
  'Creative and Production',
  'IT',
  'Engineering',
] as const;

function normalizeDepartment(department?: string | null): string {
  if (!department) {
    return 'Other';
  }

  return ALLOWED_DEPARTMENTS.includes(
    department as (typeof ALLOWED_DEPARTMENTS)[number],
  )
    ? department
    : 'Other';
}

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private businessUnitsService: BusinessUnitsService,
  ) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private isWideScoped(user: AuthUser & { roles?: string[] }): boolean {
    const wide = new Set<string>([
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.HR,
      Role.COMPLIANCE_MANAGER,
    ]);
    if (user.isPlatformAdmin === true || user.isSuperAdmin === true)
      return true;
    if (user.role && wide.has(user.role as string)) return true;
    if (Array.isArray(user.roles) && user.roles.some((r) => wide.has(r)))
      return true;
    return false;
  }

  private async resolveCurrentEmployeeId(user: AuthUser) {
    if (user.employeeId) {
      return user.employeeId;
    }

    const organizationId = this.validateOrganization(user);
    const linked = await this.prisma.user.findUnique({
      where: { id: user.userId, organizationId },
      select: { employeeId: true },
    });

    if (!linked?.employeeId) {
      throw new ForbiddenException('User is not linked to an employee profile');
    }

    return linked.employeeId;
  }

  private async getScope(
    user: AuthUser & {
      roles?: string[];
      businessUnitId?: number | null;
      allBusinessUnits?: boolean;
    },
  ): Promise<Prisma.EmployeeWhereInput> {
    const scope = await this.businessUnitsService.resolveScope(user);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(scope);

    if (this.isWideScoped(user)) {
      return buWhere;
    }

    if (
      user.role === Role.MANAGER ||
      (Array.isArray(user.roles) && user.roles.includes(Role.MANAGER))
    ) {
      return { AND: [buWhere, { user: { managerId: user.userId } }] };
    }

    const employeeId = await this.resolveCurrentEmployeeId(user);
    return { AND: [buWhere, { id: employeeId }] };
  }

  private isPlatformSuperAdmin(user: AuthUser): boolean {
    return (
      user.role === Role.SUPER_ADMIN ||
      (Array.isArray(user.roles) && user.roles.includes(Role.SUPER_ADMIN)) ||
      user.isPlatformAdmin === true ||
      user.isSuperAdmin === true
    );
  }

  private normalizeReportingManagerIds(
    managerIds?: number[],
    legacyManagerId?: number,
  ): number[] | undefined {
    if (managerIds === undefined && legacyManagerId === undefined) {
      return undefined;
    }

    const ids = [...(managerIds ?? [])];
    if (legacyManagerId !== undefined && !ids.includes(legacyManagerId)) {
      ids.unshift(legacyManagerId);
    }
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new BadRequestException(
        'managerIds must contain only positive integer user IDs.',
      );
    }
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('managerIds must not contain duplicates.');
    }
    return ids;
  }

  private async validateReportingManagers(
    managerIds: number[],
    organizationId: number,
    user: AuthUser,
    employeeUserId?: number,
    businessUnitId?: number | null,
  ) {
    if (employeeUserId !== undefined && managerIds.includes(employeeUserId)) {
      throw new BadRequestException('An employee cannot report to themselves.');
    }

    if (managerIds.length === 0) {
      return [];
    }

    const managers = await this.prisma.user.findMany({
      where: {
        id: { in: managerIds },
        isActive: true,
        OR: [
          { organizationId },
          { role: Role.SUPER_ADMIN },
        ],
      },
      select: {
        id: true,
        name: true,
        role: true,
        organizationId: true,
        primaryBusinessUnitId: true,
      },
    });

    if (managers.length !== managerIds.length) {
      throw new NotFoundException(
        'One or more selected reporting managers were not found in the organization.',
      );
    }

    const allowedRoles = new Set<Role>([
      Role.MANAGER,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);
    if (managers.some((manager) => !allowedRoles.has(manager.role))) {
      throw new BadRequestException(
        'Selected reporting managers must have MANAGER, ADMIN, or SUPER_ADMIN role.',
      );
    }

    if (businessUnitId != null) {
      const scope = await this.businessUnitsService.resolveScope(user as any);
      await this.businessUnitsService.assertRecordAccessible(
        scope,
        businessUnitId,
        'employee:reportingManager',
      );
      if (
        managers.some(
          (manager) =>
            manager.organizationId === organizationId &&
            manager.primaryBusinessUnitId != null &&
            manager.primaryBusinessUnitId !== businessUnitId,
        )
      ) {
        throw new ForbiddenException(
          'Reporting managers must belong to the employee Business Unit.',
        );
      }
    }

    return managers;
  }

  async create(
    createEmployeeDto: CreateEmployeeDto,
    user: AuthUser,
    organizationIdOverride?: number | null,
  ) {
    const callerIsPlatformAdmin = this.isPlatformSuperAdmin(user);

    if (
      !callerIsPlatformAdmin &&
      organizationIdOverride != null &&
      user.organizationId != null &&
      organizationIdOverride !== user.organizationId
    ) {
      throw new ForbiddenException(
        'Cannot create employee in a different organization',
      );
    }

    const organizationId =
      organizationIdOverride ?? user.organizationId ?? null;

    if (!organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }

    if (
      createEmployeeDto.department &&
      !ALLOWED_DEPARTMENTS.includes(
        createEmployeeDto.department as (typeof ALLOWED_DEPARTMENTS)[number],
      )
    ) {
      throw new BadRequestException(
        'Invalid department. Must be one of: Sales, Operations, Marketing, HR, Finance, Creative and Production, IT, Engineering',
      );
    }

    const wantsLoginAccount =
      typeof createEmployeeDto.password === 'string' &&
      createEmployeeDto.password.length > 0;

    const userRole = (createEmployeeDto.role ?? Role.EMPLOYEE) as Role;
    const reportingManagerIds = this.normalizeReportingManagerIds(
      createEmployeeDto.managerIds,
      createEmployeeDto.managerId,
    );

    if (reportingManagerIds !== undefined && !wantsLoginAccount) {
      throw new BadRequestException(
        'Reporting managers require an employee login account.',
      );
    }

    if (wantsLoginAccount) {
      if (!createEmployeeDto.email || !createEmployeeDto.email.trim()) {
        throw new BadRequestException(
          'Email is required when creating a login account for the employee.',
        );
      }

      const allowedRolesForEmployee: Role[] = [
        Role.EMPLOYEE,
        Role.MANAGER,
        Role.HR,
      ];
      if (!allowedRolesForEmployee.includes(userRole)) {
        throw new BadRequestException(
          `Invalid role. Must be one of: ${allowedRolesForEmployee.join(', ')}`,
        );
      }

      if (reportingManagerIds !== undefined) {
        await this.validateReportingManagers(
          reportingManagerIds,
          organizationId,
          user,
          undefined,
          createEmployeeDto.businessUnitId,
        );
      }

      const existingUserByEmail = await this.prisma.user.findFirst({
        where: {
          email: createEmployeeDto.email.trim(),
          organizationId,
        },
        select: { id: true },
      });
      if (existingUserByEmail) {
        throw new ConflictException(
          'A user with this email already exists in the organization.',
        );
      }
    }

    if (createEmployeeDto.businessUnitId) {
      const businessUnit = await this.prisma.businessUnit.findFirst({
        where: {
          id: createEmployeeDto.businessUnitId,
          organizationId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!businessUnit) {
        throw new NotFoundException(
          'Selected Business Unit not found in the organization.',
        );
      }
      const callerScope = await this.businessUnitsService.resolveScope(
        user as any,
      );
      await this.businessUnitsService.assertRecordAccessible(
        callerScope,
        createEmployeeDto.businessUnitId,
        'employee:businessUnit',
      );
    }

    const hashedPassword = wantsLoginAccount
      ? await hashPassword(createEmployeeDto.password!)
      : null;

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          organization: { connect: { id: organizationId } },
          name: createEmployeeDto.name,
          email: createEmployeeDto.email,
          phoneNumber: createEmployeeDto.phoneNumber,
          department: createEmployeeDto.department,
          designation: createEmployeeDto.designation,
          hireDate: createEmployeeDto.hireDate
            ? new Date(createEmployeeDto.hireDate)
            : null,
          manager: createEmployeeDto.manager,
          leaveBalance: createEmployeeDto.leaveBalance,
          status: createEmployeeDto.status,
          businessUnit: createEmployeeDto.businessUnitId
            ? { connect: { id: createEmployeeDto.businessUnitId } }
            : undefined,
        },
        include: { user: true },
      });

      if (wantsLoginAccount) {
        const emailNormalized = createEmployeeDto.email!.trim();

        const appRole = await tx.appRole.upsert({
          where: { name: userRole },
          update: {},
          create: {
            name: userRole,
            description: `Auto-created role for ${userRole}`,
          },
        });

        const createdUser = await tx.user.create({
          data: {
            organizationId,
            name: createEmployeeDto.name,
            email: emailNormalized,
            password: hashedPassword!,
            role: userRole,
            employeeId: employee.id,
            managerId: reportingManagerIds?.[0],
            primaryBusinessUnitId:
              createEmployeeDto.businessUnitId ?? undefined,
            designation: createEmployeeDto.designation,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            employeeId: true,
            managerId: true,
            organizationId: true,
            designation: true,
            createdAt: true,
          },
        });

        await tx.userRole.upsert({
          where: {
            userId_roleId: {
              userId: createdUser.id,
              roleId: appRole.id,
            },
          },
          update: {},
          create: {
            userId: createdUser.id,
            roleId: appRole.id,
          },
        });

        if (reportingManagerIds && reportingManagerIds.length > 0) {
          await tx.userReportingManager.createMany({
            data: reportingManagerIds.map((managerId) => ({
              employeeId: createdUser.id,
              managerId,
            })),
            skipDuplicates: true,
          });
        }

        const responseUser = await tx.user.findUnique({
          where: { id: createdUser.id },
          select: {
            id: true,
            role: true,
            managerId: true,
            manager: { select: { id: true, name: true } },
            reportingManagers: {
              select: {
                manager: { select: { id: true, name: true, role: true } },
              },
            },
          },
        });

        return {
          ...employee,
          user: { ...createdUser, ...responseUser },
        };
      }

      return employee;
    });
  }

  async findAll(user: AuthUser) {
    const where = await this.getScope(user);
    return this.prisma.employee.findMany({
      where,
      include: {
        shift: true,
        user: {
          select: {
            id: true,
            managerId: true,
            manager: { select: { id: true, name: true } },
            reportingManagers: {
              select: {
                manager: { select: { id: true, name: true, role: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const where = await this.getScope(user);
    const employee = await this.prisma.employee.findFirst({
      where: { id, ...(where ?? {}) },
      include: {
        shift: true,
        user: {
          select: {
            id: true,
            role: true,
            managerId: true,
            manager: { select: { id: true, name: true } },
            reportingManagers: {
              select: {
                manager: { select: { id: true, name: true, role: true } },
              },
            },
          },
        },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async findByDepartment(user: AuthUser) {
    const where = await this.getScope(user);
    const employees = await this.prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const grouped: Record<string, typeof employees> = {};
    for (const emp of employees) {
      const dept = normalizeDepartment(emp.department);
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(emp);
    }
    return grouped;
  }

  async findByDesignation(user: AuthUser) {
    const where = await this.getScope(user);
    const employees = await this.prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const grouped: Record<string, typeof employees> = {};
    for (const emp of employees) {
      const key = emp.designation?.trim()
        ? emp.designation.trim()
        : 'Unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(emp);
    }
    return grouped;
  }

  async update(
    id: number,
    updateEmployeeDto: UpdateEmployeeDto,
    user: AuthUser & { roles?: string[] },
  ) {
    const organizationId = this.validateOrganization(user);
    const employee = await this.findOne(id, user);
    const canPrivilegedEdit =
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      user.role === Role.MANAGER ||
      (user.roles &&
        (user.roles.includes(Role.ADMIN) ||
          user.roles.includes(Role.SUPER_ADMIN) ||
          user.roles.includes(Role.HR) ||
          user.roles.includes(Role.MANAGER)));

    if (!canPrivilegedEdit) {
      const selfEmployeeId = await this.resolveCurrentEmployeeId(user);
      if (employee.id !== selfEmployeeId) {
        throw new ForbiddenException('You can only update your own profile');
      }

      // Employee self-service should be limited to personal/contact updates.
      const restricted: Partial<UpdateEmployeeDto> = {
        email: updateEmployeeDto.email,
        phoneNumber: updateEmployeeDto.phoneNumber,
      };

      return this.prisma.employee.update({
        where: { id, organizationId },
        data: restricted,
      });
    }

    const reportingManagerIds = this.normalizeReportingManagerIds(
      updateEmployeeDto.managerIds,
      updateEmployeeDto.managerId,
    );
    const { managerIds: _managerIds, managerId: _managerId, ...employeeDto } =
      updateEmployeeDto;
    const data: Prisma.EmployeeUpdateInput = { ...employeeDto };
    if (updateEmployeeDto.hireDate) {
      data.hireDate = new Date(updateEmployeeDto.hireDate);
    }
    if (reportingManagerIds !== undefined) {
      if (!employee.user?.id) {
        throw new BadRequestException(
          'Reporting managers require an employee login account.',
        );
      }
      await this.validateReportingManagers(
        reportingManagerIds,
        organizationId,
        user,
        employee.user.id,
        updateEmployeeDto.businessUnitId ?? employee.businessUnitId,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id, organizationId },
        data,
      });

      if (reportingManagerIds !== undefined && employee.user?.id) {
        await tx.user.update({
          where: { id: employee.user.id, organizationId },
          data: { managerId: reportingManagerIds[0] ?? null },
        });
        await tx.userReportingManager.deleteMany({
          where: { employeeId: employee.user.id },
        });
        if (reportingManagerIds.length > 0) {
          await tx.userReportingManager.createMany({
            data: reportingManagerIds.map((managerId) => ({
              employeeId: employee.user!.id,
              managerId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return result;
    });

    if (canPrivilegedEdit && updateEmployeeDto.designation !== undefined) {
      await this.prisma.user.updateMany({
        where: { employeeId: updated.id, organizationId },
        data: { designation: updateEmployeeDto.designation ?? null },
      });
    }

    return this.findOne(id, user);
  }

  async remove(id: number, user: AuthUser) {
    const employee = await this.findOne(id, user);
    return this.prisma.employee.update({
      where: { id: employee.id },
      data: { deletedAt: new Date() },
    });
  }

  async findDeleted(user: AuthUser) {
    const scope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(scope);
    return this.prisma.employee.findMany({
      where: { ...buWhere, deletedAt: { not: null } },
      include: {
        shift: true,
        user: {
          select: {
            id: true,
            managerId: true,
            manager: { select: { id: true, name: true } },
            reportingManagers: {
              select: {
                manager: { select: { id: true, name: true, role: true } },
              },
            },
          },
        },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async restore(id: number, user: AuthUser) {
    const scope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(scope);
    const deletedEmployee = await this.prisma.employee.findFirst({
      where: {
        id,
        ...buWhere,
        deletedAt: { not: null },
      },
      select: { id: true },
    });

    if (!deletedEmployee) {
      throw new NotFoundException('Deleted employee not found');
    }

    return this.prisma.employee.update({
      where: { id: deletedEmployee.id },
      data: { deletedAt: null },
    });
  }

  async importRecords(
    records: Array<Record<string, unknown>>,
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    const organizationId = this.validateOrganization(user);
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (typeof r.name !== 'string' || !r.name) {
        errors.push(`Row ${i + 1}: 'name' is required`);
        continue;
      }
      try {
        const data: Prisma.EmployeeCreateInput = {
          organization: { connect: { id: organizationId } },
          name: String(r.name),
          email: typeof r.email === 'string' ? r.email : undefined,
          phoneNumber:
            typeof r.phoneNumber === 'string' ? r.phoneNumber : undefined,
          department:
            typeof r.department === 'string' ? r.department : undefined,
          designation:
            typeof r.designation === 'string' ? r.designation : undefined,
          hireDate:
            typeof r.hireDate === 'string' || r.hireDate instanceof Date
              ? new Date(String(r.hireDate))
              : undefined,
          manager: typeof r.manager === 'string' ? r.manager : undefined,
          leaveBalance:
            typeof r.leaveBalance === 'number'
              ? r.leaveBalance
              : typeof r.leaveBalance === 'string'
                ? Number(r.leaveBalance)
                : undefined,
          status: typeof r.status === 'string' ? r.status : undefined,
        };

        await this.prisma.employee.create({ data });
        imported++;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${message}`);
      }
    }
    return { imported, errors };
  }
}
