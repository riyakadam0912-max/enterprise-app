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

const ALLOWED_DEPARTMENTS = [
  'Sales',
  'Engineering',
  'HR',
  'Finance',
  'Operations',
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
  constructor(private prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
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
    user: AuthUser & { roles?: string[] },
  ): Promise<Prisma.EmployeeWhereInput | undefined> {
    const organizationId = this.validateOrganization(user);
    if (
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      (user.roles &&
        (user.roles.includes(Role.ADMIN) ||
          user.roles.includes(Role.SUPER_ADMIN) ||
          user.roles.includes(Role.HR)))
    ) {
      return { deletedAt: null, organizationId };
    }

    if (
      user.role === Role.MANAGER ||
      (user.roles && user.roles.includes(Role.MANAGER))
    ) {
      return {
        deletedAt: null,
        organizationId,
        user: { managerId: user.userId },
      };
    }

    const employeeId = await this.resolveCurrentEmployeeId(user);
    return {
      id: employeeId,
      deletedAt: null,
      organizationId,
    };
  }

  private isPlatformSuperAdmin(user: AuthUser): boolean {
    return (
      user.role === Role.SUPER_ADMIN ||
      (Array.isArray(user.roles) && user.roles.includes(Role.SUPER_ADMIN)) ||
      user.isPlatformAdmin === true ||
      user.isSuperAdmin === true
    );
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
        'Invalid department. Must be one of: Sales, Engineering, HR, Finance, Operations',
      );
    }

    const wantsLoginAccount =
      typeof createEmployeeDto.password === 'string' &&
      createEmployeeDto.password.length > 0;

    const userRole = (createEmployeeDto.role ?? Role.EMPLOYEE) as Role;

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

      if (createEmployeeDto.managerId) {
        const managerUser = await this.prisma.user.findUnique({
          where: { id: createEmployeeDto.managerId, organizationId },
          select: { id: true, role: true },
        });
        if (!managerUser) {
          throw new NotFoundException(
            'Selected manager user not found in the organization.',
          );
        }
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
            managerId: createEmployeeDto.managerId ?? undefined,
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

        return {
          ...employee,
          user: createdUser,
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
      const key = emp.designation?.trim() ? emp.designation.trim() : 'Unassigned';
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

    const data: Prisma.EmployeeUpdateInput = { ...updateEmployeeDto };
    if (updateEmployeeDto.hireDate) {
      data.hireDate = new Date(updateEmployeeDto.hireDate);
    }
    const updated = await this.prisma.employee.update({
      where: { id, organizationId },
      data,
    });

    if (
      canPrivilegedEdit &&
      updateEmployeeDto.designation !== undefined
    ) {
      await this.prisma.user.updateMany({
        where: { employeeId: updated.id, organizationId },
        data: { designation: updateEmployeeDto.designation ?? null },
      });
    }

    return updated;
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.employee.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async findDeleted(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.employee.findMany({
      where: { deletedAt: { not: null }, organizationId },
      include: {
        shift: true,
        user: {
          select: {
            id: true,
            managerId: true,
            manager: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async restore(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const deletedEmployee = await this.prisma.employee.findFirst({
      where: {
        id,
        deletedAt: { not: null },
        organizationId,
      },
      select: { id: true },
    });

    if (!deletedEmployee) {
      throw new NotFoundException('Deleted employee not found');
    }

    return this.prisma.employee.update({
      where: { id, organizationId },
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
