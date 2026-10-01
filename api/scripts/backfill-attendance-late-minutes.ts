import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { calculateLateMinutesInTimezone } from '../src/attendance/attendance-time.utils';

const prisma = new PrismaClient();

type Args = {
  apply: boolean;
  organizationId?: number;
  dateFrom?: Date;
  dateTo?: Date;
};

function parseDate(value: string, flag: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${flag} must use YYYY-MM-DD format`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${flag} is not a valid calendar date`);
  }
  return date;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === '--apply') {
      args.apply = true;
    } else if (value === '--organization-id') {
      const id = Number(argv[++index]);
      if (!Number.isInteger(id) || id < 1) {
        throw new Error('--organization-id requires a positive integer');
      }
      args.organizationId = id;
    } else if (value === '--from') {
      args.dateFrom = parseDate(argv[++index] ?? '', '--from');
    } else if (value === '--to') {
      args.dateTo = parseDate(argv[++index] ?? '', '--to');
    } else if (value === '--help') {
      console.log(
        'Usage: npm run attendance:backfill-late -- [--apply] [--organization-id ID] [--from YYYY-MM-DD] [--to YYYY-MM-DD]',
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  if (args.dateFrom && args.dateTo && args.dateFrom > args.dateTo) {
    throw new Error('--from must be earlier than or equal to --to');
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const where = {
    deletedAt: null,
    checkIn: { not: null },
    ...(args.organizationId ? { organizationId: args.organizationId } : {}),
    ...(args.dateFrom || args.dateTo
      ? {
          date: {
            ...(args.dateFrom ? { gte: args.dateFrom } : {}),
            ...(args.dateTo
              ? { lte: new Date(args.dateTo.getTime() + 86_400_000 - 1) }
              : {}),
          },
        }
      : {}),
  };
  const rows = await prisma.attendance.findMany({
    where,
    select: {
      id: true,
      date: true,
      checkIn: true,
      lateMinutes: true,
      shift: {
        select: {
          type: true,
          startTime: true,
          gracePeriodMinutes: true,
        },
      },
      employee: {
        select: {
          shift: {
            select: {
              type: true,
              startTime: true,
              gracePeriodMinutes: true,
            },
          },
          organization: { select: { timezone: true } },
        },
      },
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });

  let changed = 0;
  let unchanged = 0;
  let missingShift = 0;
  for (const row of rows) {
    if (!row.checkIn) continue;
    const shift = row.shift ?? row.employee.shift;
    if (!shift) {
      missingShift++;
      continue;
    }

    const recalculatedLateMinutes = calculateLateMinutesInTimezone(
      row.checkIn,
      row.date.toISOString().slice(0, 10),
      shift,
      row.employee.organization.timezone,
    );
    if (recalculatedLateMinutes === row.lateMinutes) {
      unchanged++;
      continue;
    }

    changed++;
    console.log(
      `${args.apply ? 'UPDATE' : 'WOULD UPDATE'} attendance #${row.id} ${row.date.toISOString().slice(0, 10)}: ${row.lateMinutes} -> ${recalculatedLateMinutes} minutes late`,
    );
    if (args.apply) {
      await prisma.attendance.update({
        where: { id: row.id },
        data: { lateMinutes: recalculatedLateMinutes },
      });
    }
  }

  console.log('\nAttendance lateness backfill summary');
  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Rows scanned: ${rows.length}`);
  console.log(`Rows with changed lateness: ${changed}`);
  console.log(`Rows unchanged: ${unchanged}`);
  console.log(`Rows skipped without a shift: ${missingShift}`);
  if (!args.apply && changed > 0) {
    console.log('Review the proposed updates, then rerun with --apply to persist.');
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      'Attendance lateness backfill failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
