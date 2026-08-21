#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true, email: true, name: true, role: true }
    });
    console.log('Super Admins:', admins);
    
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true }
    });
    console.log('\nAll Users:', allUsers.length);
  } finally {
    await prisma.$disconnect();
  }
})();
