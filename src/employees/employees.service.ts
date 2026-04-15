import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Role } from '../common/enums/role.enum';

type AuthUser = { userId: number; role: Role; employeeId?: number | null };

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  private async resolveCurrentEmployeeId(user: AuthUser) {
    if (user.employeeId) {
      return user.employeeId;
    }

    const linked = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { employeeId: true },
    } as any) as { employeeId?: number | null } | null;

    if (!linked?.employeeId) {
      throw new ForbiddenException('User is not linked to an employee profile');
    }

    return linked.employeeId;
  }

  private async getScope(user: AuthUser): Promise<Record<string, any> | undefined> {
    if (user.role === Role.ADMIN || user.role === Role.HR) {
      return undefined;
    }

    if (user.role === Role.MANAGER) {
      return { user: { managerId: user.userId } };
    }

    const employeeId = await this.resolveCurrentEmployeeId(user);
    return { id: employeeId };
  }

  async create(createEmployeeDto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        name: createEmployeeDto.name,
        email: createEmployeeDto.email,
        phoneNumber: createEmployeeDto.phoneNumber,
        department: createEmployeeDto.department,
        designation: createEmployeeDto.designation,
        hireDate: createEmployeeDto.hireDate ? new Date(createEmployeeDto.hireDate) : null,
        manager: createEmployeeDto.manager,
        leaveBalance: createEmployeeDto.leaveBalance,
        status: createEmployeeDto.status,
      },
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
    } as any);
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
    } as any);
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async findByDepartment(user: AuthUser) {
    const where = await this.getScope(user);
    const employees = await this.prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
    } as any);

    const grouped: Record<string, typeof employees> = {};
    for (const emp of employees) {
      const dept = emp.department ?? 'Unassigned';
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(emp);
    }
    return grouped;
  }

  async update(id: number, updateEmployeeDto: UpdateEmployeeDto, user: AuthUser) {
    const employee = await this.findOne(id, user);
    const canPrivilegedEdit = user.role === Role.ADMIN || user.role === Role.HR || user.role === Role.MANAGER;

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

      return this.prisma.employee.update({ where: { id }, data: restricted as any });
    }

    const data: any = { ...updateEmployeeDto };
    if (data.hireDate) data.hireDate = new Date(data.hireDate);
    return this.prisma.employee.update({ where: { id }, data });
  }

  async remove(id: number) {
    return this.prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.name) { errors.push(`Row ${i + 1}: 'name' is required`); continue; }
      try {
        await this.prisma.employee.create({
          data: {
            name:         String(r.name),
            email:        r.email        ? String(r.email)        : undefined,
            phoneNumber:  r.phoneNumber  ? String(r.phoneNumber)  : undefined,
            department:   r.department   ? String(r.department)   : undefined,
            designation:  r.designation  ? String(r.designation)  : undefined,
            hireDate:     r.hireDate     ? new Date(String(r.hireDate)) : undefined,
            manager:      r.manager      ? String(r.manager)      : undefined,
            leaveBalance: r.leaveBalance ? Number(r.leaveBalance) : undefined,
            status:       r.status       ? String(r.status)       : undefined,
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }
}