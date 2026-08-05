const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, organizationId: true, password: true },
    orderBy: { id: 'asc' },
    take: 30,
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
