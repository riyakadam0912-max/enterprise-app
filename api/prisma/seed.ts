import {
  AttendanceStatus,
  PrismaClient,
  Role,
  ShiftType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Permission } from '../src/common/enums/permissions.enum';

const prisma = new PrismaClient();

const EMPLOYEES_COUNT = 5;
const MANAGERS_COUNT = 2;
const TASKS_PER_EMPLOYEE = 5;
const MONTHS_TO_SEED = 3;

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
      "UserRole",
      "RolePermission",
      "AppRole",
      "Permission",
      "ProjectMessage",
      "ProjectLink",
      "ProjectMember",
      "Project",
      "User",
      "Employee"
    RESTART IDENTITY CASCADE;
  `);
}

async function createAdminUser(defaultOrgId: number) {
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@erp.local' },
    update: {
      name: 'Admin User',
      password: adminPasswordHash,
      role: Role.ADMIN,
      isActive: true,
      employeeId: null,
      managerId: null,
      organizationId: defaultOrgId,
    },
    create: {
      name: 'Admin User',
      email: 'admin@erp.local',
      password: adminPasswordHash,
      role: Role.ADMIN,
      isActive: true,
      organizationId: defaultOrgId,
    },
  });

  return prisma.user.findUniqueOrThrow({ where: { email: 'admin@erp.local' } });
}

async function createSuperAdminUser() {
  const superAdminPasswordHash = await bcrypt.hash('Admin@123', 10);

  await prisma.user.upsert({
    where: { email: 'superadmin@erp.local' },
    update: {
      name: 'Super Admin User',
      password: superAdminPasswordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
      employeeId: null,
      managerId: null,
      organizationId: null, // SUPER_ADMIN is platform-level
    },
    create: {
      name: 'Super Admin User',
      email: 'superadmin@erp.local',
      password: superAdminPasswordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
      organizationId: null, // SUPER_ADMIN is platform-level
    },
  });

  return prisma.user.findUniqueOrThrow({
    where: { email: 'superadmin@erp.local' },
  });
}

async function seedPermissions() {
  console.log('Seeding permissions...');
  const permissionsToCreate = Object.values(Permission).map((key) => ({
    key,
    description: `Permission for ${key}`,
  }));

  for (const permission of permissionsToCreate) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {},
      create: permission,
    });
  }
  console.log(`Seeded ${permissionsToCreate.length} permissions.`);
  return prisma.permission.findMany();
}

async function seedRolesWithPermissions() {
  console.log('Seeding roles and role permissions...');
  const rolesConfig = [
    {
      name: 'SUPER_ADMIN',
      description: 'Platform Super Admin with full access',
      permissions: Object.values(Permission),
    },
    {
      name: 'ADMIN',
      description: 'Administrator with broad access',
      permissions: [
        Permission.EMPLOYEE_READ,
        Permission.EMPLOYEE_CREATE,
        Permission.EMPLOYEE_UPDATE,
        Permission.EMPLOYEE_DELETE,
        Permission.PAYROLL_READ,
        Permission.PAYROLL_CREATE,
        Permission.PAYROLL_UPDATE,
        Permission.PAYROLL_APPROVE,
        Permission.INVOICE_READ,
        Permission.INVOICE_CREATE,
        Permission.INVOICE_UPDATE,
        Permission.INVOICE_APPROVE,
        Permission.INVOICE_DELETE,
        Permission.PROJECT_READ,
        Permission.PROJECT_CREATE,
        Permission.PROJECT_UPDATE,
        Permission.PROJECT_MANAGE,
        Permission.PROJECT_DELETE,
        Permission.EXPENSE_READ,
        Permission.EXPENSE_CREATE,
        Permission.EXPENSE_UPDATE,
        Permission.EXPENSE_APPROVE,
        Permission.EXPENSE_DELETE,
        Permission.LEAVE_READ,
        Permission.LEAVE_CREATE,
        Permission.LEAVE_UPDATE,
        Permission.LEAVE_APPROVE,
        Permission.LEAVE_DELETE,
        Permission.ATTENDANCE_READ,
        Permission.ATTENDANCE_CREATE,
        Permission.ATTENDANCE_UPDATE,
        Permission.ATTENDANCE_DELETE,
        Permission.LEAD_READ,
        Permission.LEAD_CREATE,
        Permission.LEAD_UPDATE,
        Permission.LEAD_DELETE,
        Permission.DEAL_READ,
        Permission.DEAL_CREATE,
        Permission.DEAL_UPDATE,
        Permission.DEAL_DELETE,
        Permission.CONTACT_READ,
        Permission.CONTACT_CREATE,
        Permission.CONTACT_UPDATE,
        Permission.CONTACT_DELETE,
        Permission.HR_MANAGE,
        Permission.USER_READ,
        Permission.USER_CREATE,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
        Permission.ROLE_READ,
      ],
    },
    {
      name: 'HR',
      description: 'Human Resources role',
      permissions: [
        Permission.EMPLOYEE_READ,
        Permission.EMPLOYEE_CREATE,
        Permission.EMPLOYEE_UPDATE,
        Permission.PAYROLL_READ,
        Permission.PAYROLL_CREATE,
        Permission.PAYROLL_UPDATE,
        Permission.EXPENSE_READ,
        Permission.EXPENSE_APPROVE,
        Permission.LEAVE_READ,
        Permission.LEAVE_APPROVE,
        Permission.ATTENDANCE_READ,
        Permission.HR_MANAGE,
      ],
    },
    {
      name: 'MANAGER',
      description: 'Team Manager role',
      permissions: [
        Permission.EMPLOYEE_READ,
        Permission.PROJECT_READ,
        Permission.PROJECT_MANAGE,
        Permission.EXPENSE_READ,
        Permission.EXPENSE_APPROVE,
        Permission.LEAVE_READ,
        Permission.LEAVE_APPROVE,
        Permission.ATTENDANCE_READ,
        Permission.TASK_READ,
      ],
    },
    {
      name: 'EMPLOYEE',
      description: 'Regular Employee role',
      permissions: [
        Permission.EMPLOYEE_READ,
        Permission.PROJECT_READ,
        Permission.EXPENSE_READ,
        Permission.EXPENSE_CREATE,
        Permission.LEAVE_READ,
        Permission.LEAVE_CREATE,
        Permission.ATTENDANCE_READ,
        Permission.ATTENDANCE_CREATE,
      ],
    },
  ];

  const allPermissions = await prisma.permission.findMany();
  const permissionMap = new Map(allPermissions.map((p) => [p.key, p.id]));

  for (const roleConfig of rolesConfig) {
    const role = await prisma.appRole.upsert({
      where: { name: roleConfig.name },
      update: { description: roleConfig.description },
      create: { name: roleConfig.name, description: roleConfig.description },
    });

    const permissionIds = roleConfig.permissions
      .map((key) => permissionMap.get(key))
      .filter((id): id is number => id !== undefined);

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    for (const permissionId of permissionIds) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId },
      });
    }
  }

  console.log(`Seeded ${rolesConfig.length} roles with permissions.`);
  return prisma.appRole.findMany({ include: { rolePermissions: true } });
}

async function assignUserRoles(users: any[]) {
  console.log('Assigning roles to users...');
  const roles = await prisma.appRole.findMany();
  const roleMap = new Map(roles.map((r) => [r.name, r.id]));

  for (const user of users) {
    const roleId = roleMap.get(user.role);
    if (roleId) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId },
      });
    }
  }
  console.log('Assigned roles to users.');
}

async function createEmployeesUsersAndTeams(shiftId: number) {
  console.log('Creating employees, managers, and team mappings...');

  const userPasswordHash = await bcrypt.hash('password123', 10);
  const records: Array<{
    employee: any;
    user: any;
    department: string;
    isManager: boolean;
  }> = [];
  const managers: any[] = [];
  const defaultOrganization = await prisma.organization.findFirst({
    where: { code: 'DEFAULT' },
    select: { id: true },
  });

  if (!defaultOrganization) {
    throw new Error('Default organization not found');
  }

  // Create MANAGERS (2 total)
  const managerDepartments = ['Engineering', 'Sales'];
  for (let i = 0; i < MANAGERS_COUNT; i++) {
    const dept = managerDepartments[i];
    const position = `${dept} Manager`;
    const employee = await prisma.employee.create({
      data: {
        name: `${dept} Manager ${i + 1}`,
        email: `manager.${i + 1}@enterprise.local`,
        phone: randomPhone(),
        position,
        designation: position,
        department: dept,
        salary: randomFloat(80000, 150000),
        hireDate: addDays(new Date(), -randomInt(60, 900)),
        leaveBalance: randomInt(6, 24),
        status: 'Active',
        pan: `PAN${randomInt(100000, 999999)}`,
        shiftId,
        organizationId: defaultOrganization.id,
      },
    });

    const user = await prisma.user.create({
      data: {
        name: employee.name,
        email: `manager.${i + 1}@enterprise.local`,
        password: userPasswordHash,
        role: Role.MANAGER,
        isActive: true,
        employeeId: employee.id,
        organizationId: defaultOrganization.id,
      },
    });

    records.push({ employee, user, department: dept, isManager: true });
    managers.push(user);
  }

  // Create EMPLOYEES (5 total)
  const employeeDepartments = [
    'Engineering',
    'Engineering',
    'Sales',
    'Sales',
    'HR',
  ];
  const employeePositions = [
    'Senior Developer',
    'Developer',
    'Account Executive',
    'Sales Rep',
    'HR Specialist',
  ];
  for (let i = 0; i < EMPLOYEES_COUNT; i++) {
    const dept = employeeDepartments[i];
    const position = employeePositions[i];
    const employee = await prisma.employee.create({
      data: {
        name: `Employee ${i + 1}`,
        email: `employee.${i + 1}@enterprise.local`,
        phone: randomPhone(),
        position,
        designation: position,
        department: dept,
        salary: randomFloat(50000, 100000),
        hireDate: addDays(new Date(), -randomInt(60, 900)),
        leaveBalance: randomInt(6, 24),
        status: 'Active',
        pan: `PAN${randomInt(100000, 999999)}`,
        shiftId,
        organizationId: defaultOrganization.id,
      },
    });

    const user = await prisma.user.create({
      data: {
        name: employee.name,
        email: `employee.${i + 1}@enterprise.local`,
        password: userPasswordHash,
        role: Role.EMPLOYEE,
        isActive: true,
        employeeId: employee.id,
        managerId: managers[i % 2].id, // Assign to manager 1 or 2 alternately
        organizationId: defaultOrganization.id,
      },
    });

    records.push({ employee, user, department: dept, isManager: false });
  }

  // Create dedicated HR user (1 total)
  const hrEmployee = await prisma.employee.create({
    data: {
      name: 'HR User',
      email: 'hr@enterprise.local',
      phone: randomPhone(),
      position: 'HR Manager',
      designation: 'HR Manager',
      department: 'HR',
      salary: randomFloat(70000, 120000),
      hireDate: addDays(new Date(), -randomInt(60, 900)),
      leaveBalance: randomInt(6, 24),
      status: 'Active',
      pan: `PAN${randomInt(100000, 999999)}`,
      shiftId,
      organizationId: defaultOrganization.id,
    },
  });

  const hrUser = await prisma.user.create({
    data: {
      name: hrEmployee.name,
      email: 'hr@enterprise.local',
      password: userPasswordHash,
      role: Role.HR,
      isActive: true,
      employeeId: hrEmployee.id,
      organizationId: defaultOrganization.id,
    },
  });

  records.push({
    employee: hrEmployee,
    user: hrUser,
    department: 'HR',
    isManager: false,
  });

  return {
    records,
    terminatedEmployeeIds: [],
    managers,
  };
}

async function createDemoProject(
  adminUser: any,
  managers: any[],
  employees: any[],
) {
  console.log('Creating demo project...');
  const startDate = new Date();
  const endDate = addDays(startDate, 90);
  const primaryManager = managers[0];

  // Create Project
  const demoProject = await prisma.project.create({
    data: {
      organizationId: 1,
      projectName: 'ERP Modernization Initiative',
      projectCode: 'ERP-001',
      startDate,
      endDate,
      manager: primaryManager.name,
      managerId: primaryManager.id,
      status: 'ACTIVE',
      budget: 500000,
      description:
        'Modernizing legacy ERP system with microservices architecture',
      client: 'Acme Corporation',
    },
  });

  // Assign 3 employees
  const assignedEmployees = employees.slice(0, 3);
  for (const emp of assignedEmployees) {
    await prisma.projectMember.create({
      data: {
        organizationId: 1,
        projectId: demoProject.id,
        employeeId: emp.employee.id,
        role: 'Team Member',
      },
    });
    await prisma.employee.update({
      where: { id: emp.employee.id },
      data: {
        assignedProjects: {
          connect: { id: demoProject.id },
        },
      },
    });
  }

  // Create 5 Tasks
  const taskStatuses = [
    'PENDING',
    'IN_PROGRESS',
    'SUBMITTED',
    'APPROVED',
    'IN_PROGRESS',
  ];
  for (let i = 0; i < 5; i++) {
    await prisma.task.create({
      data: {
        organizationId: 1,
        taskName: `Task ${i + 1}: ${['Requirements', 'Design', 'Development', 'Testing', 'Deployment'][i]}`,
        projectId: demoProject.id,
        assignee: assignedEmployees[i % 3].employee.name,
        assignedToId: assignedEmployees[i % 3].employee.id,
        assignedToUserId: assignedEmployees[i % 3].user.id,
        assignedByUserId: primaryManager.id,
        dueDate: addDays(startDate, 10 + i * 10),
        priority: ['HIGH', 'MEDIUM', 'MEDIUM', 'LOW', 'HIGH'][i],
        status: taskStatuses[i],
        estimatedHours: 20 + i * 10,
        actualHours: 15 + i * 8,
      },
    });
  }

  // Create 3 Project Links
  const links = [
    { title: 'GitHub Repo', url: 'https://github.com/acme/erp-modernization' },
    { title: 'Jira Board', url: 'https://jira.acme.com/browse/ERP' },
    { title: 'Design Docs', url: 'https://docs.acme.com/erp-design' },
  ];
  for (const link of links) {
    await prisma.projectLink.create({
      data: {
        organizationId: 1,
        projectId: demoProject.id,
        title: link.title,
        url: link.url,
        createdById: adminUser.id,
      },
    });
  }

  // Create 10 realistic Chat Messages with varying senders and timestamps
  const now = new Date();
  const messages = [
    {
      sender: adminUser,
      content:
        'Welcome to the ERP Modernization project! This will be our primary communication channel.',
      createdAt: addDays(now, -7),
    },
    {
      sender: primaryManager,
      content:
        'Team, please review the requirements document linked above and share your feedback by EOD tomorrow.',
      createdAt: addDays(now, -6.8),
    },
    {
      sender: assignedEmployees[0].user,
      content:
        "I've completed the initial draft of the functional requirements document. Can someone take a look?",
      createdAt: addDays(now, -5.5),
    },
    {
      sender: primaryManager,
      content:
        "Great work! I'll review it this afternoon and provide feedback.",
      createdAt: addDays(now, -5.4),
    },
    {
      sender: assignedEmployees[1].user,
      content: "I'll start working on the system design mockups this week.",
      createdAt: addDays(now, -4.2),
    },
    {
      sender: assignedEmployees[2].user,
      content: 'Let me know if you need help with the database schema design.',
      createdAt: addDays(now, -4),
    },
    {
      sender: assignedEmployees[0].user,
      content: "Thanks! I'll loop you in once the initial design is ready.",
      createdAt: addDays(now, -3.8),
    },
    {
      sender: primaryManager,
      content:
        'Quick update: We have a stakeholder meeting on Friday to discuss the project timeline.',
      createdAt: addDays(now, -2.5),
    },
    {
      sender: adminUser,
      content: 'Great progress so far! Keep up the good work everyone.',
      createdAt: addDays(now, -1.2),
    },
    {
      sender: assignedEmployees[1].user,
      content:
        'Just pushed the first draft of the design docs to the repo. Feedback welcome!',
      createdAt: addDays(now, -0.5),
    },
  ];
  for (const msg of messages) {
    await prisma.projectMessage.create({
      data: {
        organizationId: 1,
        projectId: demoProject.id,
        senderId: msg.sender.id,
        content: msg.content,
        createdAt: msg.createdAt,
      },
    });
  }

  console.log('Demo project created successfully!');
  return demoProject;
}

async function createAttendanceHistory(
  records: Array<{ employee: any }>,
  shiftId: number,
) {
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
          checkOut.setHours(
            status === AttendanceStatus.HALF_DAY ? 13 : 18,
            randomInt(0, 40),
            0,
            0,
          );
        }

        rows.push({
          organizationId: 1,
          employeeId: record.employee.id,
          shiftId,
          date: startOfDay(current),
          checkIn,
          checkOut,
          workingHours,
          lateMinutes,
          overtimeHours:
            status === AttendanceStatus.PRESENT && Math.random() < 0.15
              ? randomFloat(0.5, 2.5)
              : 0,
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

async function createTasks(
  records: Array<{
    employee: any;
    user: any;
    department: string;
    isManager: boolean;
  }>,
  adminUserId: number,
) {
  console.log(`Creating ${TASKS_PER_EMPLOYEE} tasks per employee...`);

  const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'];
  const priorities = ['LOW', 'MEDIUM', 'HIGH'];

  for (const record of records) {
    for (let i = 0; i < TASKS_PER_EMPLOYEE; i++) {
      await prisma.task.create({
        data: {
          organizationId: 1,
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
    const monthLabel = monthDate.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const cycle = await prisma.payrollCycle.create({
      data: {
        organizationId: 1,
        name: `${monthLabel} Payroll`,
        month,
        year,
        status: 'APPROVED',
        runDate: new Date(year, month, 0),
      },
    });

    for (const record of records) {
      const grossPay =
        (record.employee.salary ?? 60000) + randomFloat(-3000, 7000);
      const totalDeductions = grossPay * randomFloat(0.1, 0.22);
      const netPay = grossPay - totalDeductions;

      await prisma.payrollEntry.create({
        data: {
          organizationId: 1,
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

    // Create or get default organization
    let defaultOrganization = await prisma.organization.findFirst({
      where: { code: 'DEFAULT' },
    });
    if (!defaultOrganization) {
      defaultOrganization = await prisma.organization.create({
        data: {
          name: 'Default Organization',
          code: 'DEFAULT',
          slug: 'default',
          status: 'ACTIVE',
        },
      });
    }

    await seedPermissions();
    await seedRolesWithPermissions();
    const admin = await createAdminUser(defaultOrganization.id);
    const superAdmin = await createSuperAdminUser();
    let shift = await prisma.shift.findFirst({
      where: {
        name: 'Standard Business Hours',
        organizationId: defaultOrganization.id,
      },
    });
    if (!shift) {
      shift = await prisma.shift.create({
        data: {
          organizationId: defaultOrganization.id,
          name: 'Standard Business Hours',
          type: ShiftType.FIXED,
          startTime: '09:00',
          endTime: '18:00',
          requiredHours: 8,
          gracePeriodMinutes: 15,
        },
      });
    }

    const { records, managers } = await createEmployeesUsersAndTeams(shift.id);
    const allUsers = [superAdmin, admin, ...records.map((r) => r.user)];
    await assignUserRoles(allUsers);

    await createAttendanceHistory(records, shift.id);
    await createTasks(records, admin.id);
    await createPayroll(records);
    await createDemoProject(
      admin,
      managers,
      records.filter((r) => !r.isManager), // Only employees (not managers)
    );

    console.log('\nSeed completed successfully.');
    console.log(`Employees: ${records.length}`);
    console.log(`Managers linked to teams: ${managers.length}`);
    console.log('Super Admin login: superadmin@erp.local / Admin@123');
    console.log('Admin login: admin@erp.local / Admin@123');
    console.log(
      'Manager logins: manager.1@enterprise.local / password123, manager.2@enterprise.local / password123',
    );
    console.log(
      'Employee logins: employee.1@enterprise.local / password123, ...\n',
    );
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
