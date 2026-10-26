import { PrismaClient } from '@prisma/client';

async function main() {
  const db = new PrismaClient();
  try {
    const overlaps = await db.$queryRaw<
      Array<{ employeeId: number; firstId: number; secondId: number }>
    >`
      SELECT a."employeeId", a.id AS "firstId", b.id AS "secondId"
      FROM "EmployeeShiftAssignment" a
      JOIN "EmployeeShiftAssignment" b ON b."employeeId" = a."employeeId" AND b.id > a.id
      WHERE tsrange(a."effectiveFrom", a."effectiveTo", '[)') && tsrange(b."effectiveFrom", b."effectiveTo", '[)')
      ORDER BY a."employeeId", a.id LIMIT 1000`;
    console.log(
      JSON.stringify(
        {
          overlaps,
          cappedAt: 1000,
          action:
            'Review historical overlaps before policy reassignment; no records changed.',
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}
void main().catch(() => {
  console.error('Could not inspect shift assignments');
  process.exitCode = 1;
});
