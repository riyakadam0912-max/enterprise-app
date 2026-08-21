/* eslint-disable */
/* ============================================================
   PHASE 5-7 COMPREHENSIVE READ-ONLY PRISMA FORENSIC AUDIT
   No UPDATE, DELETE, CREATE, UPSERT, or INSERT operations.
   Only SELECT / count(). NEVER prints password or hash.
   ============================================================ */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_EMAIL = 'edadmin@ekdrishti.com';

async function main() {
  console.log('============================================================');
  console.log('FRESH READ-ONLY PRODUCTION DB FORENSIC AUDIT');
  console.log('============================================================');

  // ---------- PHASE 4: DB IDENTITY ----------
  console.log('\n[PHASE 4] DATABASE IDENTITY:');
  try {
    const rawVersion = await prisma.$queryRawUnsafe("SELECT version()::text as version");
    const v = rawVersion[0]?.version || '';
    console.log('  DB_PROVIDER:', /postgres/i.test(v) ? 'PostgreSQL' : 'OTHER');
    const m = v.match(/PostgreSQL (\d+\.\d+)/);
    console.log('  DB_VERSION_SNIPPET:', m ? m[1] : 'unknown');
  } catch (e) { console.log('  version(): ERROR (ignored)'); }

  try {
    const r = await prisma.$queryRawUnsafe("SELECT current_database() as db");
    console.log('  DATABASE_NAME:', r[0]?.db);
  } catch (e) {}

  try {
    const r = await prisma.$queryRawUnsafe("SELECT current_schema() as sch");
    console.log('  SCHEMA:', r[0]?.sch);
  } catch (e) {}

  try {
    const r = await prisma.$queryRawUnsafe("SELECT 1 as n");
    console.log('  CONNECTION_TEST:', r[0]?.n === 1 ? 'SUCCESS' : 'FAILURE');
  } catch (e) {
    console.log('  CONNECTION_TEST: FAILURE ->', e.message);
  }

  // ---------- PHASE 5: DB HEALTH COUNTS ----------
  console.log('\n[PHASE 5] RECORD COUNTS:');
  const safeCount = async (name, fn) => { try { return await fn(); } catch { return -1; } };
  const counts = {
    organizations: await safeCount('organization', () => prisma.organization.count()),
    users: await safeCount('user', () => prisma.user.count()),
    employees: await safeCount('employee', () => prisma.employee.count()),
    approles: await safeCount('appRole', () => prisma.appRole.count()),
    permissions: await safeCount('permission', () => prisma.permission.count()),
    userroles: await safeCount('userRole', () => prisma.userRole.count()),
    rolepermissions: await safeCount('rolePermission', () => prisma.rolePermission.count()),
    auditlogs: await safeCount('auditLog', () => prisma.auditLog.count()),
  };
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.toUpperCase()}:`, v >= 0 ? v : 'UNAVAILABLE');

  // ---------- PHASE 6: ALL SUPER_ADMIN USERS ----------
  console.log('\n[PHASE 6] SUPER_ADMIN USERS (legacy role=SUPER_ADMIN):');
  const legacySAs = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      organizationId: true, employeeId: true, createdAt: true, updatedAt: true,
    },
  });
  console.log('  TOTAL_SUPER_ADMIN_USERS (legacy field):', legacySAs.length);
  console.log('  ACTIVE_SUPER_ADMIN_USERS (legacy):', legacySAs.filter(u => u.isActive).length);
  for (const u of legacySAs) {
    console.log(`    user#${u.id}: name=${u.name} email=${u.email} active=${u.isActive} orgId=${u.organizationId} empId=${u.employeeId} updatedAt=${u.updatedAt.toISOString()}`);
  }

  // SUPER_ADMIN AppRole
  console.log('\n[PHASE 6] RBAC SUPER_ADMIN APPROLE:');
  const saAppRole = await prisma.appRole.findUnique({
    where: { name: 'SUPER_ADMIN' },
    include: {
      _count: { select: { rolePermissions: true, userRoles: true } },
    },
  });
  if (!saAppRole) {
    console.log('  SUPER_ADMIN_APPROLE_EXISTS: NO');
  } else {
    console.log('  SUPER_ADMIN_APPROLE_EXISTS: YES');
    console.log('  APPROLE_ID:', saAppRole.id);
    console.log('  APPROLE_DESCRIPTION:', saAppRole.description);
    console.log('  ROLE_PERMISSION_COUNT:', saAppRole._count.rolePermissions);
    console.log('  USER_ROLE_ASSIGNMENT_COUNT:', saAppRole._count.userRoles);

    const usersLinkedViaUserRole = await prisma.userRole.findMany({
      where: { roleId: saAppRole.id },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true, role: true, organizationId: true } },
      },
    });
    console.log('  RBAC SUPER_ADMIN USER ASSIGNMENTS:');
    for (const ur of usersLinkedViaUserRole) {
      console.log(`    UserRole[userId=${ur.userId},roleId=${ur.roleId}] -> user#${ur.user.id} name=${ur.user.name} email=${ur.user.email} active=${ur.user.isActive} legacyRole=${ur.user.role} orgId=${ur.user.organizationId}`);
    }
  }

  // ---------- PHASE 7: TARGET ACCOUNT ----------
  console.log('\n[PHASE 7] TARGET ACCOUNT AUDIT (email=' + TARGET_EMAIL + '):');
  const dupes = await prisma.user.findMany({
    where: { email: TARGET_EMAIL },
    select: { id: true, name: true, email: true, role: true, isActive: true, organizationId: true, employeeId: true },
  });
  console.log('  DUPLICATE_EMAIL_COUNT:', dupes.length);
  const target = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      organizationId: true, employeeId: true, updatedAt: true,
      userRoles: {
        include: {
          role: { include: { _count: { select: { rolePermissions: true } } } },
        },
      },
    },
  });

  if (!target) {
    console.log('  ACCOUNT_EXISTS: NO');
    console.log('  All checks below = N/A');
  } else {
    const hasSARole = target.userRoles.some(ur => ur.role.name === 'SUPER_ADMIN');
    console.log('  ACCOUNT_EXISTS: YES');
    console.log('  ACCOUNT_ID:', target.id);
    console.log('  NAME_MATCH (expected "Chinmay Shivdikar"):', target.name === 'Chinmay Shivdikar' ? 'MATCH' : 'MISMATCH (' + target.name + ')');
    console.log('  EMAIL_MATCH:', target.email === TARGET_EMAIL ? 'MATCH' : 'MISMATCH');
    console.log('  ROLE (legacy field):', target.role);
    console.log('  ACTIVE:', target.isActive ? 'YES' : 'NO');
    console.log('  ORGANIZATION_ID:', target.organizationId === null ? 'NULL (correct for platform admin)' : String(target.organizationId) + ' (ALERT: expected NULL)');
    console.log('  EMPLOYEE_ID:', target.employeeId === null ? 'NULL (correct)' : String(target.employeeId) + ' (WARNING: platform admin should not be employee-linked)');
    console.log('  USER_ROLE_PRESENT:', target.userRoles.length > 0 ? 'YES (' + target.userRoles.length + ')' : 'NO');
    for (const ur of target.userRoles) {
      console.log(`    -> UserRole roleName=${ur.role.name} permissionCount=${ur.role._count.rolePermissions}`);
    }
    console.log('  SUPER_ADMIN_USERROLE_LINK_PRESENT:', hasSARole ? 'YES' : 'NO');
    console.log('  APP_ROLE_PRESENT (SUPER_ADMIN in AppRole):', saAppRole ? 'YES' : 'NO');
    console.log('  PERMISSION_COUNT (SUPER_ADMIN AppRole):', saAppRole?._count.rolePermissions ?? 'N/A');
    console.log('  LAST_UPDATED_AT:', target.updatedAt.toISOString());
  }

  // Password hash presence/format ONLY — never prints
  console.log('\n[PHASE 7b] PASSWORD HASH PRESENCE CHECK (VALUE NEVER PRINTED):');
  if (target) {
    const withPwd = await prisma.user.findUnique({
      where: { email: TARGET_EMAIL },
      select: { password: true },
    });
    const pwd = withPwd?.password || '';
    console.log('  PASSWORD_FIELD_PRESENT:', pwd ? 'YES' : 'NO');
    console.log('  PASSWORD_HASH_LENGTH:', pwd.length);
    const bcryptFmt = /^\$2[aby]\$\d{2}\$/.test(pwd);
    console.log('  HASH_FORMAT_VALID_BCRYPT:', bcryptFmt ? 'YES' : 'NO');
    if (pwd) {
      // safe prefix only: $2b$10$ type tag
      console.log('  HASH_PREFIX_SAFE_ONLY:', pwd.substring(0, 7));
    }
    console.log('  BCRYPT_RESULT_AGAINST_OPERATOR_PASSWORD: NOT_CHECKED (password not provided in audit context)');
  }

  // Organizations status
  console.log('\n[ORGANIZATIONS]');
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true, status: true },
    orderBy: { id: 'asc' },
  });
  for (const o of orgs) {
    console.log(`  org#${o.id}: name=${o.name} slug=${o.slug} status=${o.status}`);
  }

  // AppRoles full
  console.log('\n[ALL APP ROLES]');
  const allAppRoles = await prisma.appRole.findMany({
    include: { _count: { select: { rolePermissions: true, userRoles: true } } },
    orderBy: { id: 'asc' },
  });
  for (const r of allAppRoles) {
    console.log(`  AppRole#${r.id}: name=${r.name} perms=${r._count.rolePermissions} users=${r._count.userRoles}`);
  }

  console.log('\n============================================================');
  console.log('AUDIT COMPLETE — ALL OPERATIONS READ-ONLY. NO CHANGES MADE.');
  console.log('============================================================');
}

main()
  .catch(e => { console.error('AUDIT_FATAL:', e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
