import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: createUserDto.email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    if (createUserDto.employeeId) {
      const employee = await this.prisma.employee.findUnique({ where: { id: createUserDto.employeeId } });
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      const mapped = await this.prisma.user.findFirst({ where: { employeeId: createUserDto.employeeId } } as any);
      if (mapped) {
        throw new ConflictException('Employee already has a login account');
      }
    }

    if (createUserDto.managerId) {
      const manager = await this.prisma.user.findUnique({ where: { id: createUserDto.managerId } });
      if (!manager) {
        throw new NotFoundException('Manager user not found');
      }
      if ((manager as any).role !== Role.MANAGER) {
        throw new ConflictException('Selected manager user must have MANAGER role');
      }
    }

    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    return this.prisma.user.create({
      data: {
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
    } as any);
  }

  async findAll() {
    return this.prisma.user.findMany({
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
    } as any);
  }

  async findAssignable(user: { userId: number; role: Role }) {
    if (user.role === Role.ADMIN || user.role === Role.HR) {
      return this.prisma.user.findMany({
        where: { isActive: true, role: { not: Role.ADMIN } },
        select: { id: true, name: true, role: true, managerId: true },
        orderBy: { name: 'asc' },
      } as any);
    }

    if (user.role === Role.MANAGER) {
      return this.prisma.user.findMany({
        where: {
          isActive: true,
          role: Role.EMPLOYEE,
          managerId: user.userId,
        },
        select: { id: true, name: true, role: true, managerId: true },
        orderBy: { name: 'asc' },
      } as any);
    }

    return [];
  }
}