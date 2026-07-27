import { Attendance, AttendanceStatus, Prisma } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { EmployeeFactory } from './employee.factory';

export class AttendanceFactory {
  static async create(
    overrides: Partial<Prisma.AttendanceUncheckedCreateInput> = {},
  ): Promise<Attendance> {
    const prisma = DatabaseHelper.getPrismaClient();
    let organizationId = overrides.organizationId;
    let employeeId = overrides.employeeId;
    if (!employeeId) {
      const employee = await EmployeeFactory.create({ organizationId });
      employeeId = employee.id;
      organizationId = employee.organizationId;
    } else if (!organizationId) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });
      if (employee) {
        organizationId = employee.organizationId;
      }
    }

    return prisma.attendance.create({
      data: {
        organizationId: organizationId ?? 0,
        employeeId: employeeId ?? 0,
        date: overrides.date || new Date(),
        status: overrides.status || AttendanceStatus.PRESENT,
        ...overrides,
      },
    });
  }

  static async createMany(
    count: number,
    organizationId: number,
    employeeId: number,
  ): Promise<Attendance[]> {
    const attendances: Attendance[] = [];
    const today = new Date();
    for (let i = 0; i < count; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      attendances.push(
        await this.create({
          organizationId,
          employeeId,
          date,
        }),
      );
    }
    return attendances;
  }
}
