import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/types/auth';
import { hashPassword } from './utils/hash-password';
import { MailService } from '../mail/mail.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

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

  private isSuperAdminUser(user: AuthUser): boolean {
    return (
      user?.isPlatformAdmin === true ||
      user?.isSuperAdmin === true ||
      user?.role === Role.SUPER_ADMIN ||
      (Array.isArray(user?.roles) && user.roles.includes(Role.SUPER_ADMIN))
    );
  }

  private isAdminUser(user: AuthUser): boolean {
    return (
      user?.role === Role.ADMIN ||
      (Array.isArray(user?.roles) && user.roles.includes(Role.ADMIN)) ||
      this.isSuperAdminUser(user)
    );
  }

  private assertPrivilegedPasswordResetAllowed(
    actor: AuthUser,
    target: { id: number; role: string | null; organizationId?: number | null },
  ) {
    if (target.id === actor.userId || target.id === actor.id) {
      throw new ForbiddenException('You cannot reset your own password');
    }

    if (this.isSuperAdminUser(actor)) {
      return;
    }

    if (this.isAdminUser(actor)) {
      if (target.role === Role.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Admins cannot reset Super Admin passwords',
        );
      }
      return;
    }

    throw new ForbiddenException(
      'Only Super Admins and Admins may reset user passwords',
    );
  }

  private async verifyResetCode(
    targetUser: {
      passwordResetCodeHash?: string | null;
      passwordResetCodeExpiresAt?: Date | string | null;
    },
    securityCode: string,
  ): Promise<boolean> {
    if (!securityCode || !targetUser.passwordResetCodeHash) {
      return false;
    }

    const expiresAt =
      targetUser.passwordResetCodeExpiresAt instanceof Date
        ? targetUser.passwordResetCodeExpiresAt
        : targetUser.passwordResetCodeExpiresAt
          ? new Date(targetUser.passwordResetCodeExpiresAt)
          : null;

    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      return false;
    }

    return bcrypt.compare(securityCode, targetUser.passwordResetCodeHash);
  }

  private async issuePasswordResetCode(
    targetUser: {
      id: number;
      email: string;
      name: string;
      role: string | null;
      organizationId?: number | null;
    },
    actor: AuthUser,
  ): Promise<string> {
    const code = String(randomInt(100000, 999999));
    const hashedCode = await hashPassword(code);
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: {
        id: targetUser.id,
        organizationId:
          targetUser.organizationId == null
            ? undefined
            : targetUser.organizationId,
      },
      data: {
        passwordResetCodeHash: hashedCode,
        passwordResetCodeExpiresAt: expiry,
      },
    });

    await this.mailService.sendEmail({
      to: targetUser.email,
      replyTo: actor.email,
      subject: 'Security code for employee password reset',
      html: `
        <p>Hello ${targetUser.name},</p>
        <p>Your password reset security code is: <strong>${code}</strong></p>
        <p>This code expires in 10 minutes.</p>
      `,
      metadata: { userId: targetUser.id, template: 'security-code' },
    });

    return code;
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
        if (!businessUnit)
          throw new NotFoundException('Business Unit not found');
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

  async requestPasswordResetCode(id: number, actor: AuthUser) {
    const organizationFilter = this.buildOrganizationFilter(actor);
    const targetUser = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    this.assertPrivilegedPasswordResetAllowed(actor, targetUser);

    if (!targetUser.email) {
      throw new BadRequestException('Target user email is required');
    }

    await this.issuePasswordResetCode(targetUser, actor);

    await this.auditLogsService.logCustomAction(
      {
        module: 'Users',
        entityType: 'User',
        entityId: targetUser.id,
        action: 'PASSWORD_RESET_CODE_REQUESTED',
        description: `${actor.name} requested a password reset security code for ${targetUser.email}`,
        userId: actor.userId ?? actor.id ?? null,
        userName: actor.name,
        userRole: actor.role ?? null,
      },
      actor,
    );

    return {
      success: true,
      message:
        'Security code sent successfully. Use it to complete the password reset.',
    };
  }

  async resetPassword(
    id: number,
    password: string,
    user: AuthUser,
    securityCode?: string,
  ) {
    const organizationFilter = this.buildOrganizationFilter(user);
    const existing = await this.prisma.user.findFirst({
      where: { id, ...organizationFilter },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        passwordResetCodeHash: true,
        passwordResetCodeExpiresAt: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    this.assertPrivilegedPasswordResetAllowed(user, existing);

    if (!password || password.trim().length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }

    if (
      !securityCode ||
      !(await this.verifyResetCode(existing, securityCode))
    ) {
      throw new ForbiddenException(
        'A valid security code is required before changing this password',
      );
    }

    const hashedPassword = await hashPassword(password);
    await this.prisma.user.update({
      where: { id, organizationId: existing.organizationId },
      data: {
        password: hashedPassword,
        passwordResetCodeHash: null,
        passwordResetCodeExpiresAt: null,
      },
    });

    await this.auditLogsService.logCustomAction(
      {
        module: 'Users',
        entityType: 'User',
        entityId: existing.id,
        action: 'PASSWORD_RESET',
        description: `${user.name} reset the password for ${existing.email}`,
        userId: user.userId ?? user.id ?? null,
        userName: user.name,
        userRole: user.role ?? null,
      },
      user,
    );

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
      where: { id, organizationId: existing.organizationId },
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
      select: { id: true, employeeId: true, organizationId: true },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    if (!existing.employeeId) {
      throw new BadRequestException('User has no linked employee record');
    }

    const employee = await this.prisma.employee.update({
      where: { id: existing.employeeId },
      data: { department },
      select: { id: true, name: true, department: true },
    });

    return {
      userId: id,
      employeeId: employee.id,
      department: employee.department,
    };
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
