-- Add an organization-scoped corporate holiday calendar.
CREATE TYPE "AttendanceStatus_new" AS ENUM (
  'PRESENT',
  'ABSENT',
  'HALF_DAY',
  'LEAVE',
  'HOLIDAY',
  'WEEKLY_OFF',
  'UPCOMING',
  'NOT_STARTED',
  'NOT_SCHEDULED'
);

ALTER TABLE "Attendance"
  ALTER COLUMN "status" TYPE "AttendanceStatus_new"
  USING ("status"::text::"AttendanceStatus_new");

DROP TYPE "AttendanceStatus";
ALTER TYPE "AttendanceStatus_new" RENAME TO "AttendanceStatus";

CREATE TABLE "Holiday" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Holiday_organizationId_date_key"
  ON "Holiday"("organizationId", "date");
CREATE INDEX "Holiday_organizationId_date_idx"
  ON "Holiday"("organizationId", "date");

ALTER TABLE "Holiday"
  ADD CONSTRAINT "Holiday_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;