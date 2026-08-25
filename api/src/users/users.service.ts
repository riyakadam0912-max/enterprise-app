import {
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/types/auth';
import { hashPassword } from './utils/hash-password';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private isPlatformAdmin(user: AuthUser): boolean {
    return (
      user?.isPlatformAdmin === true ||
      user?.isSuperAdmin === true ||
      user?.role === Role.SUPER_ADMIN ||
      (Array.isArray(user?.roles) && user.roles.includes(Role.SUPER_ADMIN))
    );
  }

  private buildOrganizationFilter(user: AuthUser) {
    if (user.organizationId != null) {
      return { organizationId: user.organizationId };
    }

    if (this.isPlatformAdmin(user)) {
      return {};
    }

    throw new ForbiddenException('User has no associated organization');
  }

  async create(
    createUserDto: CreateUserDto,
    user: AuthUser,
    organizationIdOverride?: number | null,
  ) {
    const effectiveOrganizationId =
      organizationIdOverride ?? user.organizationId ?? null;
    const organizationFilter = this.buildOrganizationFilter({
      ...user,
      organizationId: effectiveOrganizationId,
    });
    const existing = await this.prisma.user.findFirst({
      where: { email: createUserDto.email, ...organizationFilter },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    if (createUserDto.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: createUserDto.employeeId, ...organizationFilter },
      });
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      const mapped = await this.prisma.user.findFirst({
        where: { employeeId: createUserDto.employeeId, ...organizationFilter },
      });
      if (mapped) {
        throw new ConflictException('Employee already has a login account');
      }
    }

    if (createUserDto.managerId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: createUserDto.managerId, ...organizationFilter },
        select: { id: true, role: true },
      });
      if (!manager) {
        throw new NotFoundException('Manager user not found');
      }
      const managerRole = manager.role as Role;
      if (managerRole !== Role.MANAGER) {
        throw new ConflictException(
          'Selected manager user must have MANAGER role',
        );
      }
    }

    if (createUserDto.primaryBusinessUnitId) {
      const businessUnit = await this.prisma.businessUnit.findFirst({
        where: {
          id: createUserDto.primaryBusinessUnitId,
          ...organizationFilter,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!businessUnit) throw new NotFoundException('Business Unit not found');
    }

    const hashedPassword = await hashPassword(createUserDto.password);

    try {
      return await this.prisma.user.create({
        data: {
          organizationId: effectiveOrganizationId ?? undefined,
          name: createUserDto.name,
          email: createUserDto.email,
          password: hashedPassword,
          role: createUserDto.role,
          employeeId: createUserDto.employeeId,
          managerId: createUserDto.managerId,
          primaryBusinessUnitId: createUserDto.primaryBusinessUnitId,
          designation: createUserDto.designation,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          employeeId: true,
          managerId: true,
          designation: true,
          manager: { select: { id: true, name: true } },
          createdAt: true,
        },
      });
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }
  }

  async findReportingManagers(
    user: AuthUser,
    activeOrganizationId?: number | null,
  ) {
    const organizationId = activeOrganizationId ?? user.organizationId;
    if (organizationId == null && !this.isPlatformAdmin(user)) {
      throw new ForbiddenException('User has no associated organization');
    }

    return this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: Role.SUPER_ADMIN },
          ...(organizationId == null
            ? []
            : [{ role: { in: [Role.ADMIN, Role.MANAGER] }, organizationId }]),
        ],
      },
      select: { id: true, name: true, role: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async findAll(user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    return this.prisma.user.findMany({
      where: { ...organizationFilter },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        employeeId: true,
        managerId: true,
        designation: true,
        manager: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        employeeId: true,
        managerId: true,
        designation: true,
        manager: { select: { id: true, name: true } },
        createdAt: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    return existing;
  }

  async update(id: number, updateUserDto: UpdateUserDto, user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.email && updateUserDto.email !== existing.email) {
      const duplicate = await this.prisma.user.findFirst({
        where: {
          email: updateUserDto.email,
          organizationId: existing.organizationId,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new ConflictException('Email already in use');
      }
    }

    const data: Record<string, unknown> = {};
    if (updateUserDto.name !== undefined) data.name = updateUserDto.name;
    if (updateUserDto.email !== undefined) data.email = updateUserDto.email;
    if (updateUserDto.role !== undefined) data.role = updateUserDto.role;
    if (updateUserDto.employeeId !== undefined)
      data.employeeId = updateUserDto.employeeId;
    if (updateUserDto.managerId !== undefined)
      data.managerId = updateUserDto.managerId;
    if (updateUserDto.primaryBusinessUnitId !== undefined) {
      if (updateUserDto.primaryBusinessUnitId !== null) {
        if (existing.organizationId == null) {
          throw new ForbiddenException(
            'A user must belong to an organization before receiving a Business Unit',
          );
        }
        const businessUnit = await this.prisma.businessUnit.findFirst({
          where: {
            id: updateUserDto.primaryBusinessUnitId,
            organizationId: existing.organizationId,
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        if (!businessUnit) throw new NotFoundException('Business Unit not found');
      }
      data.primaryBusinessUnitId = updateUserDto.primaryBusinessUnitId;
    }
    if (updateUserDto.organizationId !== undefined)
      data.organizationId = updateUserDto.organizationId;
    if (updateUserDto.isActive !== undefined)
      data.isActive = updateUserDto.isActive;
    if (updateUserDto.designation !== undefined)
      data.designation = updateUserDto.designation;
    if (updateUserDto.password) {
      data.password = await hashPassword(updateUserDto.password);
    }

    try {
      return await this.prisma.user.update({
        where: { id, organizationId: existing.organizationId },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          employeeId: true,
          managerId: true,
          designation: true,
          manager: { select: { id: true, name: true } },
          createdAt: true,
        },
      });
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }
  }

  async updateRole(id: number, role: Role, user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (existing.id === user.id) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const isSuperAdmin =
      user.role === Role.SUPER_ADMIN || user.isSuperAdmin === true;
    const lowerRoles = new Set<Role>([
      Role.COMPLIANCE_MANAGER,
      Role.HR,
      Role.MANAGER,
      Role.EMPLOYEE,
    ]);
    if (!isSuperAdmin && !lowerRoles.has(role)) {
      throw new ForbiddenException(
        'Organization admins can assign lower-level roles only',
      );
    }

    return this.prisma.user.update({
      where: { id, organizationId: existing.organizationId },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        employeeId: true,
        managerId: true,
        designation: true,
        manager: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id, organizationId: existing.organizationId },
    });
    return { success: true, message: 'User deleted successfully' };
  }

  async activate(id: number, user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id, organizationId: existing.organizationId },
      data: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        employeeId: true,
        managerId: true,
        designation: true,
        manager: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  async deactivate(id: number, user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id, organizationId: existing.organizationId },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        employeeId: true,
        managerId: true,
        designation: true,
        manager: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  async resetPassword(id: number, password: string, user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await hashPassword(password);
    await this.prisma.user.update({
      where: { id, organizationId: existing.organizationId },
      data: { password: hashedPassword },
    });
    return { success: true, message: 'Password reset successfully' };
  }

  async unlock(id: number, user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id, organizationId: existing.organizationId },
      data: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        employeeId: true,
        managerId: true,
        designation: true,
        manager: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  async assignOrganization(id: number, organizationId: number, user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: { organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        employeeId: true,
        managerId: true,
        designation: true,
        manager: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  async assignRoles(id: number, roleIds: number[], user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const roles = await this.prisma.appRole.findMany({
      where: { id: { in: roleIds } },
      select: { id: true },
    });
    if (roles.length !== roleIds.length) {
      throw new NotFoundException('One or more roles were not found');
    }

    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    await this.prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId: id, roleId })),
    });

    return { success: true, message: 'Roles assigned successfully' };
  }

  async assignDepartment(id: number, department: string, user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id, organizationId: existing.organizationId },
      data: { role: existing.role },
    });
  }

  async assignManager(id: number, managerId: number | null, user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: managerId, ...organizationFilter },
      });
      if (!manager) {
        throw new NotFoundException('Manager user not found');
      }
    }

    return this.prisma.user.update({
      where: { id, organizationId: existing.organizationId },
      data: { managerId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        employeeId: true,
        managerId: true,
        designation: true,
        manager: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  async findAssignable(user: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(user);
    if (
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      this.isPlatformAdmin(user)
    ) {
      return this.prisma.user.findMany({
        where: {
          isActive: true,
          role: { not: Role.ADMIN },
          ...organizationFilter,
        },
        select: {
          id: true,
          name: true,
          role: true,
          managerId: true,
          designation: true,
        },
        orderBy: { name: 'asc' },
      });
    }

    if (user.role === Role.MANAGER) {
      return this.prisma.user.findMany({
        where: {
          isActive: true,
          role: Role.EMPLOYEE,
          managerId: user.userId,
          ...organizationFilter,
        },
        select: {
          id: true,
          name: true,
          role: true,
          managerId: true,
          designation: true,
        },
        orderBy: { name: 'asc' },
      });
    }

    return [];
  }
}
