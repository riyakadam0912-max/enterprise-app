const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const orgs = await prisma.organization.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        slug: true,
        status: true,
        subscriptionPlan: true,
        createdAt: true,
        users: { select: { id: true, email: true, role: true } },
      },
      orderBy: { id: 'asc' },
    });
    console.log(JSON.stringify(orgs, null, 2));
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
