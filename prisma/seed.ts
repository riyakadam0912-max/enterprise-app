import { AttendanceStatus, PrismaClient, Role, ShiftType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const EMPLOYEES_COUNT = 50;
const MANAGERS_COUNT = 5;
const TASKS_PER_EMPLOYEE = 5;
const MONTHS_TO_SEED = 3;

const DEPARTMENT_PLAN = [
  { name: 'Sales', count: 14, managerSlots: 2, positions: ['Sales Manager', 'Account Executive', 'Sales Rep'], salary: { min: 50000, max: 100000 } },
  { name: 'Engineering', count: 14, managerSlots: 1, positions: ['Engineering Manager', 'Senior Developer', 'Developer'], salary: { min: 80000, max: 150000 } },
  { name: 'HR', count: 11, managerSlots: 1, positions: ['HR Manager', 'HR Specialist', 'Recruiter'], salary: { min: 45000, max: 85000 } },
  { name: 'Finance', count: 11, managerSlots: 1, positions: ['Finance Manager', 'Accountant', 'Financial Analyst'], salary: { min: 55000, max: 120000 } },
] as const;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, precision = 2): number {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(precision));
}

function choose<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function randomPhone(): string {
  return `+91${randomInt(7000000000, 9999999999)}`;
}

async function clearDatabase() {
  console.log('Clearing seed data...');
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Activity",
      "Task",
      "Attendance",
      "PayrollEntry",
      "PayrollCycle",
      "User",
      "Employee"
    RESTART IDENTITY CASCADE;
  `);
}

async function createAdminUser() {
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      name: 'Admin User',
      password: adminPasswordHash,
      role: Role.ADMIN,
      isActive: true,
      employeeId: null,
      managerId: null,
    },
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: adminPasswordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  return prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' } });
}

async function createShift() {
  return prisma.shift.create({
    data: {
      name: 'Standard Business Hours',
      type: ShiftType.FIXED,
      startTime: '09:00',
      endTime: '18:00',
      requiredHours: 8,
      gracePeriodMinutes: 15,
    },
  });
}

async function createEmployeesUsersAndTeams(shiftId: number) {
  console.log('Creating employees, managers, and team mappings...');

  const userPasswordHash = await bcrypt.hash('password123', 10);
  const records: Array<{ employee: any; user: any; department: string; isManager: boolean }> = [];
  const managersByDepartment: Record<string, any[]> = {
    Sales: [],
    Engineering: [],
    HR: [],
    Finance: [],
  };

  let employeeSequence = 1;

  for (const department of DEPARTMENT_PLAN) {
    for (let i = 0; i < department.count; i++) {
      const isManager = i < department.managerSlots;
      const role = isManager ? Role.MANAGER : Role.EMPLOYEE;
      const position = isManager ? department.positions[0] : choose(department.positions);

      const employee = await prisma.employee.create({
        data: {
          name: `${department.name} Employee ${i + 1}`,
          email: `emp.${employeeSequence}@enterprise.local`,
          phone: randomPhone(),
          position,
          designation: position,
          department: department.name,
          salary: randomFloat(department.salary.min, department.salary.max),
          hireDate: addDays(new Date(), -randomInt(60, 900)),
          leaveBalance: randomInt(6, 24),
          status: 'Active',
          pan: `PAN${randomInt(100000, 999999)}`,
          shiftId,
        },
      });

      const user = await prisma.user.create({
        data: {
          name: employee.name,
          email: isManager
            ? `${department.name.toLowerCase()}.manager.${i + 1}@enterprise.local`
            : `user.${employeeSequence}@enterprise.local`,
          password: userPasswordHash,
          role,
          isActive: true,
          employeeId: employee.id,
        },
      });

      records.push({ employee, user, department: department.name, isManager });

      if (isManager) {
        managersByDepartment[department.name].push(user);
      }

      employeeSequence += 1;
    }
  }

  // Link employees to managers in the same department to validate role-aware scopes.
  for (const record of records) {
    if (record.isManager) {
      continue;
    }
    const departmentManagers = managersByDepartment[record.department];
    const managerUser = choose(departmentManagers);

    await prisma.user.update({
      where: { id: record.user.id },
      data: { managerId: managerUser.id },
    });
  }

  // Ensure exactly 10% terminated employees for turnover analytics.
  const terminatedCount = Math.floor(EMPLOYEES_COUNT * 0.1);
  const nonManagers = records.filter((record) => !record.isManager);
  const shuffled = [...nonManagers].sort(() => Math.random() - 0.5);
  const terminated = shuffled.slice(0, terminatedCount);

  for (const record of terminated) {
    await prisma.employee.update({
      where: { id: record.employee.id },
      data: { status: 'Terminated' },
    });

    await prisma.user.update({
      where: { id: record.user.id },
      data: { isActive: false },
    });
  }

  return {
    records,
    terminatedEmployeeIds: terminated.map((item) => item.employee.id),
    managers: records.filter((item) => item.isManager).map((item) => item.user),
  };
}

async function createAttendanceHistory(records: Array<{ employee: any }>, shiftId: number) {
  console.log('Creating 3 months of attendance data...');

  const today = startOfDay(new Date());
  const startDate = addDays(today, -89);
  const rows: any[] = [];

  for (const record of records) {
    let current = new Date(startDate);

    while (current <= today) {
      if (isBusinessDay(current)) {
        const chance = Math.random();
        let status: AttendanceStatus = AttendanceStatus.PRESENT;
        let checkIn: Date | null = null;
        let checkOut: Date | null = null;
        let lateMinutes = 0;
        let workingHours: number | null = 8;

        if (chance < 0.08) {
          status = AttendanceStatus.ABSENT;
          workingHours = null;
        } else if (chance < 0.18) {
          lateMinutes = randomInt(10, 45);
        } else if (chance < 0.23) {
          status = AttendanceStatus.HALF_DAY;
          workingHours = 4;
        }

        if (status !== AttendanceStatus.ABSENT) {
          checkIn = new Date(current);
          checkIn.setHours(9, randomInt(0, 35), 0, 0);

          checkOut = new Date(current);
          checkOut.setHours(status === AttendanceStatus.HALF_DAY ? 13 : 18, randomInt(0, 40), 0, 0);
        }

        rows.push({
          employeeId: record.employee.id,
          shiftId,
          date: startOfDay(current),
          checkIn,
          checkOut,
          workingHours,
          lateMinutes,
          overtimeHours: status === AttendanceStatus.PRESENT && Math.random() < 0.15 ? randomFloat(0.5, 2.5) : 0,
          requiredHours: 8,
          status,
        });
      }

      current = addDays(current, 1);
    }
  }

  for (let i = 0; i < rows.length; i += 300) {
    await prisma.attendance.createMany({
      data: rows.slice(i, i + 300),
      skipDuplicates: true,
    });
  }

  console.log(`Created ${rows.length} attendance rows.`);
}

async function createTasks(records: Array<{ employee: any; user: any; department: string; isManager: boolean }>, adminUserId: number) {
  console.log(`Creating ${TASKS_PER_EMPLOYEE} tasks per employee...`);

  const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'];
  const priorities = ['LOW', 'MEDIUM', 'HIGH'];

  for (const record of records) {
    for (let i = 0; i < TASKS_PER_EMPLOYEE; i++) {
      await prisma.task.create({
        data: {
          taskName: `${record.department} Task ${i + 1} - ${record.employee.name}`,
          project: `${record.department} Internal`,
          assignee: record.employee.name,
          assignedToId: record.employee.id,
          assignedToUserId: record.user.id,
          assignedByUserId: record.user.managerId ?? adminUserId,
          dueDate: addDays(new Date(), randomInt(2, 45)),
          priority: choose(priorities),
          status: choose(statuses),
          estimatedHours: randomFloat(2, 16),
          actualHours: randomFloat(1, 14),
          notes: `Auto-generated task for workload and status analytics (${i + 1}/${TASKS_PER_EMPLOYEE}).`,
        },
      });
    }
  }

  console.log(`Created ${records.length * TASKS_PER_EMPLOYEE} tasks.`);
}

async function createPayroll(records: Array<{ employee: any }>) {
  console.log('Creating 3 months of payroll data...');

  const now = new Date();
  const cycleMonths = [
    new Date(now.getFullYear(), now.getMonth() - 2, 1),
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    new Date(now.getFullYear(), now.getMonth(), 1),
  ];

  for (const monthDate of cycleMonths) {
    const month = monthDate.getMonth() + 1;
    const year = monthDate.getFullYear();
    const monthLabel = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const cycle = await prisma.payrollCycle.create({
      data: {
        name: `${monthLabel} Payroll`,
        month,
        year,
        status: 'APPROVED',
        runDate: new Date(year, month, 0),
      },
    });

    for (const record of records) {
      const grossPay = (record.employee.salary ?? 60000) + randomFloat(-3000, 7000);
      const totalDeductions = grossPay * randomFloat(0.1, 0.22);
      const netPay = grossPay - totalDeductions;

      await prisma.payrollEntry.create({
        data: {
          payrollCycleId: cycle.id,
          employeeId: record.employee.id,
          grossPay: Number(grossPay.toFixed(2)),
          totalDeductions: Number(totalDeductions.toFixed(2)),
          netPay: Number(netPay.toFixed(2)),
          status: choose(['PENDING', 'APPROVED', 'PAID']),
          totalPresentDays: randomInt(18, 23),
          totalAbsentDays: randomInt(0, 3),
          lateCount: randomInt(0, 5),
          overtimeHours: randomFloat(0, 18),
          remarks: `Payroll entry for ${monthLabel}`,
        },
      });
    }
  }

  console.log(`Created ${records.length * MONTHS_TO_SEED} payroll entries.`);
}

async function main() {
  try {
    console.log('Starting seed for turnover + role-aware analytics dataset...');

    await clearDatabase();
    const admin = await createAdminUser();
    const shift = await createShift();

    const { records, terminatedEmployeeIds, managers } = await createEmployeesUsersAndTeams(shift.id);
    await createAttendanceHistory(records, shift.id);
    await createTasks(records, admin.id);
    await createPayroll(records);

    console.log('\nSeed completed successfully.');
    console.log(`Departments: ${DEPARTMENT_PLAN.length} (Sales, Engineering, HR, Finance)`);
    console.log(`Employees: ${records.length}`);
    console.log(`Managers linked to teams: ${managers.length}`);
    console.log(`Terminated employees: ${terminatedEmployeeIds.length}`);
    console.log(`Tasks: ${records.length * TASKS_PER_EMPLOYEE}`);
    console.log(`Payroll records: ${records.length * MONTHS_TO_SEED}`);
    console.log('\nAdmin login: admin@example.com / admin123');
    console.log('Employee login password: password123\n');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
