import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_EMAIL = 'edadmin@ekdrishti.com';

async function main() {
  console.log('============================================================');
  console.log('PRODUCTION DATABASE FORENSIC AUDIT - READ ONLY');
  console.log('============================================================');

  console.log('\n--- DB CONNECTIVITY ---');
  try {
    const oneResult = await prisma.$queryRawUnsafe<{ n: number }[]>('SELECT 1 as n');
    console.log('Prisma queryRaw: OK');
  } catch (e) {
    console.log('Prisma queryRaw: FAILED ->', (e as Error).message);
  }

  try {
    const version = await prisma.$queryRawUnsafe<{ version: string }[]>(
      "SELECT version()::text as version"
    );
    const v = version[0]?.version ?? '';
    const provider = v.toLowerCase().includes('postgres') ? 'PostgreSQL' : 'UNKNOWN';
    console.log('DB Provider:', provider);
    const majorMatch = v.match(/PostgreSQL (\d+\.\d+)/);
    console.log('PG Version snippet:', majorMatch ? majorMatch[1] : 'not parsed');
  } catch (e) {
    console.log('DB version: FAILED ->', (e as Error).message);
  }

  try {
    const currentDb = await prisma.$queryRawUnsafe<{ db: string }[]>(
      "SELECT current_database() as db"
    );
    console.log('Current DB name:', currentDb[0]?.db ?? 'N/A');
  } catch (e) {
    console.log('Current DB name: FAILED');
  }

  console.log('\n--- RECORD COUNTS ---');
  const counts = {
    users: 0,
    organizations: 0,
    employees: 0,
    approles: 0,
    userroles: 0,
    permissions: 0,
    rolepermissions: 0,
  };
  try { counts.users = await prisma.user.count(); } catch {}
  try { counts.organizations = await prisma.organization.count(); } catch {}
  try { counts.employees = await prisma.employee.count(); } catch {}
  try { counts.approles = await prisma.appRole.count(); } catch {}
  try { counts.userroles = await prisma.userRole.count(); } catch {}
  try { counts.permissions = await prisma.permission.count(); } catch {}
  try { counts.rolepermissions = await prisma.rolePermission.count(); } catch {}

  console.log('User count:', counts.users);
  console.log('Organization count:', counts.organizations);
  console.log('Employee count:', counts.employees);
  console.log('AppRole count:', counts.approles);
  console.log('UserRole count:', counts.userroles);
  console.log('Permission count:', counts.permissions);
  console.log('RolePermission count:', counts.rolepermissions);

  console.log('\n--- TARGET USER METADATA ---');
  const targetUserNoPwd = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      organizationId: true,
      employeeId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!targetUserNoPwd) {
    console.log('USER EXISTS: NO');
  } else {
    console.log('USER EXISTS: YES');
    console.log('  id:', targetUserNoPwd.id);
    console.log('  name:', targetUserNoPwd.name);
    console.log('  email:', targetUserNoPwd.email);
    console.log('  role (legacy field):', targetUserNoPwd.role);
    console.log('  isActive:', targetUserNoPwd.isActive);
    console.log('  organizationId:', targetUserNoPwd.organizationId);
    console.log('  employeeId:', targetUserNoPwd.employeeId);
    console.log('  createdAt:', targetUserNoPwd.createdAt.toISOString());
    console.log('  updatedAt:', targetUserNoPwd.updatedAt.toISOString());

    const userWithPwd = await prisma.user.findUnique({
      where: { email: TARGET_EMAIL },
      select: { password: true },
    });
    const pwd = userWithPwd?.password ?? null;
    console.log('\n--- PASSWORD HASH FORENSICS ---');
    console.log('  password_hash_present:', pwd ? 'YES' : 'NO');
    if (pwd) {
      const bcryptFormat = /^\$2[aby]\$\d{2}\$/.test(pwd);
      console.log('  password_hash_format_valid (bcrypt regex):', bcryptFormat ? 'YES' : 'NO');
      const hashPrefix = pwd.substring(0, 7);
      console.log('  hash_prefix (safe - only $2a$10$ etc):', hashPrefix);
      console.log('  hash_length:', pwd.length);
      console.log('  password_matches: UNKNOWN (password not provided in audit context)');
    } else {
      console.log('  password_hash_format_valid: NO');
      console.log('  password_matches: CANNOT_CHECK');
    }

    const userId = targetUserNoPwd.id;

    console.log('\n--- RBAC AUDIT ---');
    const superAdminAppRole = await prisma.appRole.findUnique({
      where: { name: 'SUPER_ADMIN' },
      include: {
        _count: { select: { rolePermissions: true, userRoles: true } },
      },
    });
    console.log('  SUPER_ADMIN_APP_ROLE_EXISTS:', superAdminAppRole ? 'YES' : 'NO');
    if (superAdminAppRole) {
      console.log('    SUPER_ADMIN AppRole ID:', superAdminAppRole.id);
      console.log('    SUPER_ADMIN description:', superAdminAppRole.description);
      console.log('    SUPER_ADMIN permission count:', superAdminAppRole._count.rolePermissions);
      console.log('    SUPER_ADMIN user assignment count:', superAdminAppRole._count.userRoles);
    }

    const targetUserRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            _count: { select: { rolePermissions: true } },
          },
        },
      },
    });
    console.log('  TARGET_USER_ROLE_COUNT:', targetUserRoles.length);
    targetUserRoles.forEach((ur) => {
      console.log('    -> UserRole[userId=', ur.userId, ',roleId=', ur.roleId, '] role:', ur.role.name, 'perms:', ur.role._count.rolePermissions);
    });
    const hasSuperAdminRoleLink = targetUserRoles.some(
      (ur) => ur.role.name === 'SUPER_ADMIN'
    );
    console.log('  TARGET_USER_HAS_SUPER_ADMIN_USERROLE_LINK:', hasSuperAdminRoleLink ? 'YES' : 'NO');

    const allSuperAdminUsers = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        organizationId: true,
      },
    });
    console.log('\n  LEGACY SUPER_ADMIN (role field) USERS:');
    console.log('    Total:', allSuperAdminUsers.length);
    console.log('    Active:', allSuperAdminUsers.filter((u) => u.isActive).length);
    allSuperAdminUsers.forEach((u) => {
      console.log(
        '      #' + u.id,
        u.email,
        'active=' + u.isActive,
        'orgId=' + u.organizationId,
        'name=' + u.name
      );
    });

    const superAdminUserRoleLinks = await prisma.userRole.findMany({
      where: { role: { name: 'SUPER_ADMIN' } },
      include: { user: { select: { id: true, email: true, isActive: true } } },
    });
    console.log('\n  RBAC SUPER_ADMIN (UserRole) ASSIGNMENTS:');
    console.log('    Total:', superAdminUserRoleLinks.length);
    superAdminUserRoleLinks.forEach((ur) => {
      console.log(
        '      UserRole[userId=' + ur.userId + ',roleId=' + ur.roleId + ']',
        'user#' + ur.user.id,
        ur.user.email,
        'active=' + ur.user.isActive
      );
    });

    const allAppRoles = await prisma.appRole.findMany({
      include: { _count: { select: { rolePermissions: true, userRoles: true } } },
    });
    console.log('\n  ALL APPROLES:');
    allAppRoles.forEach((r) => {
      console.log(
        '    AppRole#' + r.id,
        r.name,
        'permissions=' + r._count.rolePermissions,
        'user_assignments=' + r._count.userRoles
      );
    });

    console.log('\n--- ORGANIZATION / TENANT AUDIT ---');
    const allOrgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
      },
    });
    console.log('  All Organizations:');
    allOrgs.forEach((o) => {
      console.log(
        '    org#' + o.id,
        'name=' + o.name,
        'slug=' + o.slug,
        'status=' + o.status,
        'created=' + o.createdAt.toISOString()
      );
    });
    console.log('  TARGET USER organizationId (expected null for platform SUPER_ADMIN):', targetUserNoPwd.organizationId);

    if (targetUserNoPwd.employeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: targetUserNoPwd.employeeId },
        select: {
          id: true,
          name: true,
          organizationId: true,
        },
      });
      console.log('  TARGET USER Employee link:', emp ? 'EXISTS' : 'BROKEN FK');
      if (emp) {
        console.log('    employee#', emp.id, 'name=', emp.name, 'emp_orgId=', emp.organizationId);
      }
    } else {
      console.log('  TARGET USER Employee link: NONE (employeeId=null)');
    }
  }

  console.log('\n--- DUPLICATE ACCOUNT CHECK ---');
  const usersWithTargetEmail = await prisma.user.findMany({
    where: { email: TARGET_EMAIL },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      organizationId: true,
    },
  });
  console.log('  Total users with email ' + TARGET_EMAIL + ':', usersWithTargetEmail.length);
  usersWithTargetEmail.forEach((u) => {
    console.log('    user#' + u.id, 'role=' + u.role, 'active=' + u.isActive, 'orgId=' + u.organizationId, 'name=' + u.name);
  });

  console.log('\n============================================================');
  console.log('READ-ONLY FORENSIC AUDIT COMPLETE - NO MODIFICATIONS MADE');
  console.log('============================================================');
}

main()
  .catch((e) => {
    console.error('AUDIT ERROR:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
