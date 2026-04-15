const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@gmail.com",
      password: "$2b$10$0MGROdtAUsTmvkCpQ6a3VO4rxaVbJzbrdOhIXcTVfjQVlzeybj3ve",
      role: "ADMIN",
    },
  });

  console.log(admin);
}

main()
  .finally(() => prisma.$disconnect());