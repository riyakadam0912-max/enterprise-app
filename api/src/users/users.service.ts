import {
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/types/auth';
import { hashPassword } from './utils/hash-password';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(createUserDto: CreateUserDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const existing = await this.prisma.user.findFirst({
      where: { email: createUserDto.email, organizationId },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    if (createUserDto.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: createUserDto.employeeId, organizationId },
      });
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      const mapped = await this.prisma.user.findFirst({
        where: { employeeId: createUserDto.employeeId, organizationId },
      });
      if (mapped) {
        throw new ConflictException('Employee already has a login account');
      }
    }

    if (createUserDto.managerId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: createUserDto.managerId, organizationId },
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

    const hashedPassword = await hashPassword(createUserDto.password);

    return this.prisma.user.create({
      data: {
        organizationId,
        name: createUserDto.name,
        email: createUserDto.email,
        password: hashedPassword,
        role: createUserDto.role,
        employeeId: createUserDto.employeeId,
        managerId: createUserDto.managerId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        employeeId: true,
        managerId: true,
        manager: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.user.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        employeeId: true,
        managerId: true,
        manager: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  async findAssignable(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    if (user.role === Role.ADMIN || user.role === Role.HR) {
      return this.prisma.user.findMany({
        where: { isActive: true, role: { not: Role.ADMIN }, organizationId },
        select: { id: true, name: true, role: true, managerId: true },
        orderBy: { name: 'asc' },
      });
    }

    if (user.role === Role.MANAGER) {
      return this.prisma.user.findMany({
        where: {
          isActive: true,
          role: Role.EMPLOYEE,
          managerId: user.userId,
          organizationId,
        },
        select: { id: true, name: true, role: true, managerId: true },
        orderBy: { name: 'asc' },
      });
    }

    return [];
  }
}
