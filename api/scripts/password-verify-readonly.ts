/* eslint-disable */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

const TARGET_EMAIL = 'edadmin@ekdrishti.com';

async function main() {
  const bcrypt_mod = await import('bcrypt');

  console.log('PASSWORD VERIFICATION DIAGNOSTIC - READ ONLY');
  console.log('=============================================');

  const candidatePasswords: { label: string; value: string }[] = [];

  const bootstrapSuperAdminPwd = (process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD || '').trim();
  if (bootstrapSuperAdminPwd) {
    candidatePasswords.push({
      label: 'BOOTSTRAP_SUPER_ADMIN_PASSWORD (.env)',
      value: bootstrapSuperAdminPwd,
    });
  }

  const bootstrapAdminPwd = (process.env.BOOTSTRAP_ADMIN_PASSWORD || '').trim();
  if (bootstrapAdminPwd) {
    candidatePasswords.push({
      label: 'BOOTSTRAP_ADMIN_PASSWORD (.env)',
      value: bootstrapAdminPwd,
    });
  }

  const user: any = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      updatedAt: true,
    },
  });

  if (!user) {
    console.log('USER NOT FOUND - cannot verify password');
    return;
  }

  console.log('User id:', user.id);
  console.log('User email:', user.email);
  console.log('User last updatedAt:', user.updatedAt.toISOString());
  console.log('Stored hash present:', user.password ? 'YES' : 'NO');
  console.log('Stored hash length:', (user.password || '').length);
  console.log('Stored hash prefix (safe):', user.password ? String(user.password).substring(0, 7) : 'N/A');
  console.log('');

  if (!user.password) {
    console.log('RESULT: No password hash stored.');
    return;
  }

  console.log('CANDIDATE PASSWORD VERIFICATION (MATCH/NO_MATCH only, hash never exposed):');
  console.log('----------------------------------------------------------------------');

  let anyMatch = false;
  for (const { label, value } of candidatePasswords) {
    const ok: boolean = await bcrypt_mod.compare(value, user.password);
    console.log(label, '->', ok ? 'MATCH' : 'NO_MATCH');
    if (ok) anyMatch = true;
  }

  console.log('');
  console.log('OVERALL_RESULT_MATCHES_LOCAL_BOOTSTRAP_ENV:', anyMatch ? 'YES' : 'NO');
}

main()
  .catch((e: any) => console.error('ERROR:', e.message))
  .finally(async () => { await prisma.$disconnect(); });
