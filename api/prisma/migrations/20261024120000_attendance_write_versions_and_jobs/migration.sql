ALTER TABLE "Attendance" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE FUNCTION attendance_increment_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."version" = OLD."version" + 1;
  RETURN NEW;
END;
$$;
CREATE TRIGGER attendance_version_before_update BEFORE UPDATE ON "Attendance"
FOR EACH ROW EXECUTE FUNCTION attendance_increment_version();

CREATE TABLE "AttendanceReconciliationJob" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "date" DATE NOT NULL,
  "cursor" INTEGER NOT NULL DEFAULT 0,
  "leaseOwner" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId", "date")
);

ALTER TABLE "Attendance" ADD COLUMN "manuallyCorrected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shift" ADD COLUMN "policyRootId" INTEGER;
ALTER TABLE "Shift" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "EmployeeShiftAssignment" ADD COLUMN "policyInferred" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Shift" SET "policyRootId" = "id";
CREATE INDEX "Shift_policyRootId_revision_idx" ON "Shift"("policyRootId", "revision");

-- Enforce future assignment transitions without deleting or rewriting old overlaps.
CREATE FUNCTION attendance_assignment_no_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(137702::integer, NEW."employeeId"::integer);
  IF NEW."effectiveTo" IS NOT NULL AND NEW."effectiveTo" <= NEW."effectiveFrom" THEN
    RAISE EXCEPTION 'Shift assignment must have a positive date range';
  END IF;
  IF EXISTS (SELECT 1 FROM "EmployeeShiftAssignment" e WHERE e."employeeId" = NEW."employeeId"
    AND e."id" <> NEW."id"
    AND tsrange(e."effectiveFrom", e."effectiveTo", '[)') && tsrange(NEW."effectiveFrom", NEW."effectiveTo", '[)')) THEN
    RAISE EXCEPTION 'Shift assignments cannot overlap';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER attendance_assignment_range BEFORE INSERT OR UPDATE ON "EmployeeShiftAssignment"
FOR EACH ROW EXECUTE FUNCTION attendance_assignment_no_overlap();
