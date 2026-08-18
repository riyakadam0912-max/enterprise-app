import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Permission } from '../src/common/enums/permissions.enum';

const prisma = new PrismaClient();

const DEFAULT_SUPER_ADMIN_EMAIL = 'superadmin@erp.local';

function readRequiredBootstrapPassword(): string {
  const value = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD?.trim();

  if (!value) {
    throw new Error(
      'Production bootstrap failed: BOOTSTRAP_SUPER_ADMIN_PASSWORD is required and must be set explicitly.',
    );
  }

  const normalized = value.toLowerCase();
  const forbidden = [
    'replace-with-secure-bootstrap-password',
    'replace-with-secure-shared-secret',
    'replace-with-secure-access-secret',
    'replace-with-secure-refresh-secret',
    'example',
    'example-secret',
    'dummy',
    'changeme',
    'password',
    'admin123',
    'superadmin123',
    'bootstrap',
    'not-set',
  ];

  if (forbidden.includes(normalized)) {
    throw new Error(
      'Production bootstrap failed: BOOTSTRAP_SUPER_ADMIN_PASSWORD must not use a placeholder or default value.',
    );
  }

  return value;
}

function readBootstrapEmail(): string {
  const fromEnv = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  return DEFAULT_SUPER_ADMIN_EMAIL;
}

async function ensureDefaultOrganization() {
  return prisma.organization.upsert({
    where: { code: 'DEFAULT' },
    update: {},
    create: {
      name: 'Default Organization',
      code: 'DEFAULT',
      slug: 'default',
      status: 'ACTIVE',
    },
  });
}

async function ensurePermissions() {
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
}

async function ensureRoleWithPermissions(name: Role, permissions: Permission[]) {
  const appRole = await prisma.appRole.upsert({
    where: { name },
    update: {},
    create: {
      name,
      description: `Role for ${name}`,
    },
  });

  for (const permissionKey of permissions) {
    const permission = await prisma.permission.findUnique({
      where: { key: permissionKey },
    });

    if (!permission) {
      continue;
    }

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: appRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: appRole.id,
        permissionId: permission.id,
      },
    });
  }
}

async function ensureRolesAndPermissions() {
  await ensurePermissions();

  await ensureRoleWithPermissions(Role.SUPER_ADMIN, Object.values(Permission));
  await ensureRoleWithPermissions(Role.ADMIN, [
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
    Permission.TASK_READ,
    Permission.TASK_CREATE,
    Permission.TASK_UPDATE,
    Permission.TASK_DELETE,
    Permission.HR_MANAGE,
    Permission.ADMIN_MANAGE,
    Permission.USER_READ,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.ROLE_READ,
    Permission.ROLE_CREATE,
    Permission.ROLE_UPDATE,
    Permission.ROLE_DELETE,
    Permission.PERMISSION_READ,
    Permission.PERMISSION_MANAGE,
  ]);

  await ensureRoleWithPermissions(Role.HR, [
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
  ]);

  await ensureRoleWithPermissions(Role.MANAGER, [
    Permission.EMPLOYEE_READ,
    Permission.PROJECT_READ,
    Permission.PROJECT_MANAGE,
    Permission.EXPENSE_READ,
    Permission.EXPENSE_APPROVE,
    Permission.LEAVE_READ,
    Permission.LEAVE_APPROVE,
    Permission.ATTENDANCE_READ,
    Permission.TASK_READ,
  ]);

  await ensureRoleWithPermissions(Role.EMPLOYEE, [
    Permission.EMPLOYEE_READ,
    Permission.PROJECT_READ,
    Permission.EXPENSE_READ,
    Permission.EXPENSE_CREATE,
    Permission.LEAVE_READ,
    Permission.LEAVE_CREATE,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_CREATE,
  ]);
}

async function ensurePlatformSuperAdmin() {
  const email = readBootstrapEmail();
  const password = readRequiredBootstrapPassword();

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ role: Role.SUPER_ADMIN }, { email }],
    },
  });

  if (existing) {
    return existing;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const created = await prisma.user.create({
    data: {
      name: 'Super Admin User',
      email,
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
      isActive: true,
      organizationId: null,
    },
  });

  const appRole = await prisma.appRole.upsert({
    where: { name: Role.SUPER_ADMIN },
    update: {},
    create: {
      name: Role.SUPER_ADMIN,
      description: 'Platform Super Admin with full access',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: created.id,
        roleId: appRole.id,
      },
    },
    update: {},
    create: {
      userId: created.id,
      roleId: appRole.id,
    },
  });

  return created;
}

export async function bootstrapProduction() {
  if (process.env.NODE_ENV === 'production') {
    // Explicit production path only; do not seed demo data or wipe the database.
  } else {
    throw new Error(
      'Production bootstrap is only allowed in NODE_ENV=production.',
    );
  }

  const defaultOrg = await ensureDefaultOrganization();
  await ensureRolesAndPermissions();
  const superAdmin = await ensurePlatformSuperAdmin();

  return {
    organizationId: defaultOrg.id,
    superAdminId: superAdmin.id,
    email: superAdmin.email,
  };
}

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(
      'This bootstrap command must run only in production. Use npm run seed for development/demo data.',
    );
  }

  const result = await bootstrapProduction();
  console.log(
    JSON.stringify({
      message: 'Production bootstrap complete',
      organizationId: result.organizationId,
      superAdminId: result.superAdminId,
      email: result.email,
    }),
  );
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Unknown bootstrap failure';
    console.error(message);
    process.exit(1);
  });
}
