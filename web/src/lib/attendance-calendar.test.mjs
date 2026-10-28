import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAttendanceCalendarCells } from './attendance-format.ts';

test('buildAttendanceCalendarCells preserves weekday alignment when records are missing', () => {
  const cells = buildAttendanceCalendarCells('2026-04', [
    { date: '2026-04-15T00:00:00.000Z' },
    { date: '2026-04-16T00:00:00.000Z' },
  ]);

  assert.equal(cells[0].key, 'blank-0');
  assert.equal(cells[17].key, '2026-04-15');
  assert.equal(cells[17].day?.date, '2026-04-15T00:00:00.000Z');
  assert.equal(cells[18].key, '2026-04-16');
});

test('buildAttendanceCalendarCells supports leap-year February', () => {
  const cells = buildAttendanceCalendarCells('2028-02', []);
  assert.equal(cells.at(-1)?.key, '2028-02-29');
});
