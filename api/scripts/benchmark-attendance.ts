import { PrismaClient } from '@prisma/client';
import { AttendanceService } from '../src/attendance/attendance.service';
import { Role } from '../src/common/enums/role.enum';

async function main() {
  const url = process.env.ATTENDANCE_TEST_DATABASE_URL;
  if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/attendance_fix_test') {
    throw new Error('Benchmark requires the disposable local attendance_fix_test database');
  }
  const db = new PrismaClient({ datasources: { db: { url } }, log: [{ emit: 'event', level: 'query' }] });
  let queries = 0;
  db.$on('query', () => { queries++; });
  try {
    for (const size of [100, 500, 1000]) {
      const code = `attendance-bench-${size}-${Date.now()}`;
      const organization = await db.organization.create({ data: { name: code, code, slug: code, timezone: 'UTC' } });
      const shift = await db.shift.create({ data: { organizationId: organization.id, name: 'Benchmark', type: 'FIXED', startTime: '09:00', endTime: '17:00', workingDays: [0,1,2,3,4,5,6] } });
      await db.employee.createMany({ data: Array.from({ length: size }, (_, i) => ({ organizationId: organization.id, shiftId: shift.id, name: `Fixture ${String(i).padStart(6, '0')}` })) });
      const service = new AttendanceService(db as any, { del: async () => undefined } as any, {
        resolveScope: async () => ({ organizationId: organization.id, allUnits: true }),
        buildEmployeeBUWhere: () => ({ organizationId: organization.id, deletedAt: null }),
        getEmployeeScopeFilterIds: async () => null,
      } as any, {
        getOrganizationIds: async () => [organization.id],
        getDescendantOrganizationIds: async () => [organization.id],
        getOrganizationFamilyRootId: async () => organization.id,
        getOrganizationFamilyRootMap: async (ids: number[]) => new Map(ids.map(id => [id, id])),
      } as any, {} as any);
      queries = 0;
      const started = performance.now();
      const result = await service.findAll({ page: 1, limit: 10, summaryMode: 'none' }, { userId: 1, role: Role.ADMIN, organizationId: organization.id });
      if (result.total !== size || result.data.length !== 10) throw new Error('Pagination/total mismatch');
      console.log(JSON.stringify({ employees: size, returned: result.data.length, total: result.total, queries, elapsedMs: Math.round(performance.now() - started) }));
    }
  } finally { await db.$disconnect(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
