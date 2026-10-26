import { test } from "node:test";
import assert from "node:assert/strict";
import {
  csvCell,
  dateTimeInZone,
  instantFromZone,
  changedInstant,
  shiftNumber,
} from "./attendance-format.ts";

test("overnight timestamps keep their distinct dates and milliseconds", () => {
  const start = "2026-10-23T16:30:12.345Z";
  const end = "2026-10-24T00:30:45.678Z";
  assert.equal(
    dateTimeInZone(start, "Asia/Kolkata"),
    "2026-10-23T22:00:12.345",
  );
  assert.equal(
    instantFromZone(dateTimeInZone(end, "Asia/Kolkata"), "Asia/Kolkata"),
    end,
  );
  assert.equal(
    changedInstant(
      dateTimeInZone(start, "America/Los_Angeles"),
      start,
      "America/Los_Angeles",
    ),
    undefined,
  );
  assert.equal(
    instantFromZone("2026-10-24T06:00:00.000", "Asia/Kolkata"),
    "2026-10-24T00:30:00.000Z",
  );
});
test("DST gaps and folds require explicit unambiguous correction", () => {
  assert.throws(
    () => instantFromZone("2026-03-08T02:30:00.000", "America/New_York"),
    /ambiguous/,
  );
  assert.throws(
    () => instantFromZone("2026-11-01T01:30:00.000", "America/New_York"),
    /ambiguous/,
  );
  assert.equal(
    changedInstant(
      "2026-11-01T01:30:00.000",
      "2026-11-01T05:30:00.000Z",
      "America/New_York",
    ),
    undefined,
  );
});
test("zero grace is preserved and invalid hours are rejected", () => {
  assert.equal(shiftNumber("0", 15, 0, 1440), 0);
  assert.equal(shiftNumber("", 15, 0, 1440), 15);
  assert.throws(() => shiftNumber("0", 8, 0.01, 24));
  assert.throws(() => shiftNumber("NaN", 8, 0.01, 24));
});
test("spreadsheet cells escape structure and neutralize formulas and controls", () => {
  for (const text of [
    "=1+1",
    "+SUM(A1)",
    "-1+2",
    "@SUM(A1)",
    "  =1",
    "\t=1",
    "\r=1",
    "\n@SUM(A1)",
  ]) {
    assert.ok(csvCell(text).startsWith("\"'"));
  }
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
  assert.equal(csvCell(42), '"42"');
});

test('fractional seconds are normalized without losing the instant', () => { assert.equal(instantFromZone('2026-10-24T06:00:00.1', 'Asia/Kolkata'), '2026-10-24T00:30:00.100Z'); });
