/* eslint-disable */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const TARGET_EMAIL = 'edadmin@ekdrishti.com';

async function main() {
  console.log('ENV KEYS PRESENT (names only, never values):');
  const ALL_KEYS = [
    'DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_ISSUER',
    'JWT_AUDIENCE', 'COOKIE_SECURE', 'COOKIE_SAME_SITE', 'COOKIE_DOMAIN',
    'FRONTEND_URL', 'FRONTEND_ORIGIN', 'BOOTSTRAP_SUPER_ADMIN_EMAIL',
    'BOOTSTRAP_SUPER_ADMIN_PASSWORD', 'BOOTSTRAP_ADMIN_PASSWORD',
    'NODE_ENV',
  ];
  for (const k of ALL_KEYS) {
    const v = process.env[k];
    const present = (v && String(v).trim().length > 0) ? 'CONFIGURED' : 'EMPTY/MISSING';
    console.log('  ', k, '=', present, present === 'CONFIGURED' ? ('(len=' + String(v).length + ')') : '');
  }
  console.log('');

  const TARGET_ENV_PWD_KEYS = [
    'BOOTSTRAP_SUPER_ADMIN_PASSWORD',
    'BOOTSTRAP_ADMIN_PASSWORD',
  ];

  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: { id: true, email: true, name: true, password: true, updatedAt: true },
  });

  if (!user || !user.password) {
    console.log('User or password missing - aborting compare');
    return;
  }

  console.log('Target user id:', user.id, 'updatedAt:', user.updatedAt.toISOString());
  console.log('Hash prefix (safe):', String(user.password).substring(0, 7));
  console.log('');
  console.log('BCRYPT COMPARE RESULTS (hash never exposed, only MATCH/NO_MATCH):');
  console.log('---------------------------------------------------------------');

  let matchCount = 0;
  for (const key of TARGET_ENV_PWD_KEYS) {
    const val = (process.env[key] || '').trim();
    if (!val) {
      console.log('  ', key, '= NOT CONFIGURED IN ENV (skipping)');
      continue;
    }
    const ok = await bcrypt.compare(val, user.password);
    console.log('  ', key, '-> bcrypt.compare = ', ok ? 'MATCH' : 'NO_MATCH');
    if (ok) matchCount++;
  }

  // Also check legacy default value patterns just in case
  const legacyDefaults = [
    { label: 'superadmin123 (demo)', value: 'superadmin123' },
    { label: 'admin123 (demo)', value: 'admin123' },
    { label: 'password (demo)', value: 'password' },
  ];
  console.log('');
  console.log('KNOWN LEGACY/DEMO PASSWORD CHECKS (for completeness only):');
  for (const { label, value } of legacyDefaults) {
    const ok = await bcrypt.compare(value, user.password);
    if (ok) {
      console.log('  !! ', label, '-> MATCH (WARNING: DEMO PASSWORD IN USE)');
      matchCount++;
    } else {
      console.log('   ', label, '-> NO_MATCH (expected)');
    }
  }

  console.log('');
  console.log('SUMMARY: Any configured password matched?', matchCount > 0 ? 'YES' : 'NO');
  console.log('If NO: The stored bcrypt hash was created from a password value that is');
  console.log('        NOT currently present in the local BOOTSTRAP_* env vars,');
  console.log('        OR the production deployment used a different env var value.');
  console.log('        Target user.updatedAt is TODAY = password was recently RE-written');
  console.log('        by bootstrap-super-admin or an equivalent password reset/update.');
}

main()
  .catch((e) => console.error('ERROR:', e.message))
  .finally(async () => { await prisma.$disconnect(); });
