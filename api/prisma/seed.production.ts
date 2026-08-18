import { PrismaClient, Role, OrganizationStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Permission } from '../src/common/enums/permissions.enum';

const prisma = new PrismaClient();

/**
 * PRODUCTION BOOTSTRAP SEED
 *
 * This seed creates only the minimum configuration required for a fresh
 * production ERP installation.
 *
 * SAFE OPERATIONS ONLY:
 * - No TRUNCATE, no DELETE all, no RESTART IDENTITY
 * - Fully idempotent (safe to run multiple times)
 * - Tenant-aware (does not assume organizationId = 1)
 * - Environment-driven (no hardcoded production passwords)
 *
 * Required Environment Variables:
 * - BOOTSTRAP_ORGANIZATION_CODE (default: "PROD")
 * - BOOTSTRAP_ORGANIZATION_NAME (default: "Production Organization")
 * - BOOTSTRAP_ORGANIZATION_SLUG (default: "production")
 * - BOOTSTRAP_ORGANIZATION_TIMEZONE (default: "Asia/Kolkata")
 * - BOOTSTRAP_ORGANIZATION_CURRENCY (default: "INR")
 * - BOOTSTRAP_SUPER_ADMIN_EMAIL
 * - BOOTSTRAP_SUPER_ADMIN_PASSWORD (must not be a placeholder)
 * - BOOTSTRAP_ADMIN_EMAIL (optional)
 * - BOOTSTRAP_ADMIN_PASSWORD (optional, required if BOOTSTRAP_ADMIN_EMAIL is set)
 */

// ============================================================================
// CONFIGURATION AND VALIDATION
// ============================================================================

function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(
      'Production bootstrap must run with NODE_ENV=production. ' +
        'For development, use: npm run seed',
    );
  }
}

function getBootstrapPassword(envKey: string, label: string): string {
  const value = process.env[envKey]?.trim();

  if (!value) {
    throw new Error(
      `Production bootstrap failed: ${envKey} is required and must be set explicitly.`,
    );
  }

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

  if (forbidden.includes(value.toLowerCase())) {
    throw new Error(
      `Production bootstrap failed: ${envKey} must not use a placeholder or default value (got: "${value}").`,
    );
  }

  return value;
}

// ============================================================================
// ORGANIZATION BOOTSTRAP
// ============================================================================

async function ensureProductionOrganization(): Promise<{
  id: number;
  code: string;
}> {
  const code =
    process.env.BOOTSTRAP_ORGANIZATION_CODE?.trim() || 'PROD';
  const name =
    process.env.BOOTSTRAP_ORGANIZATION_NAME?.trim() ||
    'Production Organization';
  const slug =
    process.env.BOOTSTRAP_ORGANIZATION_SLUG?.trim() || 'production';
  const timezone =
    process.env.BOOTSTRAP_ORGANIZATION_TIMEZONE?.trim() || 'Asia/Kolkata';
  const currency =
    process.env.BOOTSTRAP_ORGANIZATION_CURRENCY?.trim() || 'INR';

  // Idempotent upsert using code as the unique key
  const org = await prisma.organization.upsert({
    where: { code },
    update: {
      // On conflict, do not modify existing organization
      // (preserve any manual configuration)
    },
    create: {
      name,
      code,
      slug,
      timezone,
      currency,
      status: OrganizationStatus.ACTIVE,
    },
  });

  console.log(
    `✓ Production organization '${org.code}' (ID: ${org.id}, TZ: ${timezone}, Currency: ${currency})`,
  );
  return org;
}

// ============================================================================
// RBAC BOOTSTRAP
// ============================================================================

async function ensurePermissions(): Promise<void> {
  const permissionsToCreate = Object.values(Permission).map((key) => ({
    key,
    description: `Permission for ${key}`,
  }));

  let createdCount = 0;
  for (const permission of permissionsToCreate) {
    const result = await prisma.permission.upsert({
      where: { key: permission.key },
      update: {},
      create: permission,
    });
    if (result) {
      createdCount++;
    }
  }

  console.log(
    `✓ Permissions: ${permissionsToCreate.length} total (${createdCount} created)`,
  );
}

async function ensureRoleWithPermissions(
  name: Role,
  permissions: Permission[],
  description: string,
): Promise<void> {
  // Ensure role exists
  const appRole = await prisma.appRole.upsert({
    where: { name },
    update: {},
    create: {
      name,
      description,
    },
  });

  // Fetch all permissions to build the permission map
  const allPermissions = await prisma.permission.findMany();
  const permissionMap = new Map(allPermissions.map((p) => [p.key, p.id]));

  // For each required permission, ensure the role-permission mapping exists
  for (const permissionKey of permissions) {
    const permissionId = permissionMap.get(permissionKey);
    if (!permissionId) {
      console.warn(
        `  Warning: Permission '${permissionKey}' not found, skipping for role '${name}'`,
      );
      continue;
    }

    // Idempotent upsert
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: appRole.id,
          permissionId,
        },
      },
      update: {},
      create: {
        roleId: appRole.id,
        permissionId,
      },
    });
  }

  console.log(`✓ Role '${name}': ${permissions.length} permissions assigned`);
}

async function ensureRolesAndPermissions(): Promise<void> {
  console.log('Bootstrapping RBAC...');

  // Step 1: Create all permissions
  await ensurePermissions();

  // Step 2: Create roles and assign permissions

  // SUPER_ADMIN: full access to everything
  await ensureRoleWithPermissions(
    Role.SUPER_ADMIN,
    Object.values(Permission),
    'Platform Super Admin with full access',
  );

  // ADMIN: broad access but excludes some admin-only permissions
  await ensureRoleWithPermissions(
    Role.ADMIN,
    [
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
    ],
    'Organization Administrator with broad access',
  );

  // HR: human resources focused permissions
  await ensureRoleWithPermissions(
    Role.HR,
    [
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
    'Human Resources Manager',
  );

  // MANAGER: team lead permissions
  await ensureRoleWithPermissions(
    Role.MANAGER,
    [
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
    'Team Manager',
  );

  // EMPLOYEE: basic permissions
  await ensureRoleWithPermissions(
    Role.EMPLOYEE,
    [
      Permission.EMPLOYEE_READ,
      Permission.PROJECT_READ,
      Permission.EXPENSE_READ,
      Permission.EXPENSE_CREATE,
      Permission.LEAVE_READ,
      Permission.LEAVE_CREATE,
      Permission.ATTENDANCE_READ,
      Permission.ATTENDANCE_CREATE,
    ],
    'Regular Employee',
  );
}

// ============================================================================
// USER BOOTSTRAP
// ============================================================================

async function ensurePlatformSuperAdmin(): Promise<{ id: number; email: string }> {
  const email = getBootstrapPassword('BOOTSTRAP_SUPER_ADMIN_EMAIL', 'Super Admin');
  const password = getBootstrapPassword(
    'BOOTSTRAP_SUPER_ADMIN_PASSWORD',
    'Super Admin',
  );

  // Check if super admin already exists
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ role: Role.SUPER_ADMIN }, { email }],
    },
  });

  if (existing) {
    console.log(`✓ Super Admin already exists (email: ${existing.email})`);
    return { id: existing.id, email: existing.email };
  }

  // Create new super admin
  const hashedPassword = await bcrypt.hash(password, 10);

  const superAdmin = await prisma.user.create({
    data: {
      name: 'Super Admin User',
      email,
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
      isActive: true,
      organizationId: null, // Platform-level user
    },
  });

  // Ensure SUPER_ADMIN AppRole is assigned
  const appRole = await prisma.appRole.findUnique({
    where: { name: Role.SUPER_ADMIN },
  });

  if (appRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: superAdmin.id,
          roleId: appRole.id,
        },
      },
      update: {},
      create: {
        userId: superAdmin.id,
        roleId: appRole.id,
      },
    });
  }

  console.log(`✓ Super Admin created (email: ${superAdmin.email})`);
  return { id: superAdmin.id, email: superAdmin.email };
}

async function ensureOrganizationAdmin(
  organizationId: number,
): Promise<{ id: number; email: string } | null> {
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();

  // Admin email is optional
  if (!adminEmail) {
    console.log('✓ Organization Admin: skipped (BOOTSTRAP_ADMIN_EMAIL not set)');
    return null;
  }

  const adminPassword = getBootstrapPassword(
    'BOOTSTRAP_ADMIN_PASSWORD',
    'Organization Admin',
  );

  // Check if admin already exists
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existing) {
    console.log(
      `✓ Organization Admin already exists (email: ${existing.email})`,
    );
    return { id: existing.id, email: existing.email };
  }

  // Create new organization admin
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Organization Admin User',
      email: adminEmail,
      password: hashedPassword,
      role: Role.ADMIN,
      isActive: true,
      organizationId,
    },
  });

  // Ensure ADMIN AppRole is assigned
  const appRole = await prisma.appRole.findUnique({
    where: { name: Role.ADMIN },
  });

  if (appRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: admin.id,
          roleId: appRole.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: appRole.id,
      },
    });
  }

  console.log(`✓ Organization Admin created (email: ${admin.email})`);
  return { id: admin.id, email: admin.email };
}

// ============================================================================
// WORKFLOW CONFIGURATION
// ============================================================================

async function ensureDefaultShift(organizationId: number): Promise<{ id: number }> {
  // Check if default shift already exists for this organization
  const existing = await prisma.shift.findFirst({
    where: {
      organizationId,
      name: 'Default Shift',
    },
  });

  if (existing) {
    console.log('✓ Default Shift already exists');
    return { id: existing.id };
  }

  // Create a sensible production default shift (9 AM to 6 PM, 8 hours)
  const shift = await prisma.shift.create({
    data: {
      name: 'Default Shift',
      type: 'FIXED',
      startTime: '09:00',
      endTime: '18:00',
      requiredHours: 8,
      gracePeriodMinutes: 15,
      isActive: true,
      organizationId,
    },
  });

  console.log(
    `✓ Default Shift created (9:00 AM - 6:00 PM, 8 hours, Grace: 15 min)`,
  );
  return { id: shift.id };
}

// ============================================================================
// MAIN BOOTSTRAP FUNCTION
// ============================================================================

export async function bootstrapProduction(): Promise<{
  organizationId: number;
  organizationCode: string;
  superAdminId: number;
  superAdminEmail: string;
  adminId?: number;
  adminEmail?: string;
}> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PRODUCTION DATABASE BOOTSTRAP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Validate production environment
    validateProductionEnvironment();

    // 1. Bootstrap Organization
    console.log('Step 1: Organization');
    const organization = await ensureProductionOrganization();

    // 2. Bootstrap RBAC
    console.log('\nStep 2: RBAC (Roles, Permissions, Mappings)');
    await ensureRolesAndPermissions();

    // 3. Bootstrap Platform Super Admin
    console.log('\nStep 3: Platform Super Admin');
    const superAdmin = await ensurePlatformSuperAdmin();

    // 4. Bootstrap Organization Admin (optional)
    console.log('\nStep 4: Organization Admin (optional)');
    const admin = await ensureOrganizationAdmin(organization.id);

    // 5. Bootstrap Default Shift
    console.log('\nStep 5: System Defaults (Shift)');
    await ensureDefaultShift(organization.id);

    console.log(
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    );
    console.log('  BOOTSTRAP COMPLETE ✓');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Summary:');
    console.log(`  Organization: ${organization.code} (ID: ${organization.id})`);
    console.log(`  Super Admin Email: ${superAdmin.email}`);
    if (admin) {
      console.log(`  Organization Admin Email: ${admin.email}`);
    }
    console.log(
      '\nNext steps:',
    );
    console.log(`  1. Set BOOTSTRAP_SUPER_ADMIN_PASSWORD in production environment`);
    if (!admin) {
      console.log(`  2. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create org admin`);
    }
    console.log('\n');

    return {
      organizationId: organization.id,
      organizationCode: organization.code,
      superAdminId: superAdmin.id,
      superAdminEmail: superAdmin.email,
      adminId: admin?.id,
      adminEmail: admin?.email,
    };
  } catch (error) {
    console.error('\n❌ BOOTSTRAP FAILED:\n', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(
      'This bootstrap command must run only in NODE_ENV=production. ' +
        'For development, use: npm run seed',
    );
  }

  await bootstrapProduction();
}

// Only run main() if this file is executed directly (not imported for testing)
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
