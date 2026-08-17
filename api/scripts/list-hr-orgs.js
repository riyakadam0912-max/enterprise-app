const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, name: true, organizationId: true },
    orderBy: { id: 'asc' },
  });
  
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true },
  });
  
  console.log('=== ORGANIZATIONS ===');
  console.log(JSON.stringify(orgs, null, 2));
  console.log('\n=== USERS (HR + other orgs + ADMIN) ===');
  console.log(JSON.stringify(users.filter(u => 
    u.role === 'HR' || u.role === 'ADMIN' || u.organizationId > 1 || u.organizationId === null
  ), null, 2));
  console.log('\n=== ALL USERS ===');
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
