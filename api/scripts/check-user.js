const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({ where: { email: 'admin@erp.local' } });
    console.log(JSON.stringify(user, null, 2));
  } finally {
    await prisma.$disconnect();
  }
})();
