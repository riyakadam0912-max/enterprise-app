-- -------------------------------------------------
-- 20260320000000_create_shift_table/migration.sql
-- -------------------------------------------------

-- 0. Create ShiftType enum
CREATE TYPE "ShiftType" AS ENUM ('FIXED', 'FLEXIBLE', 'ROTATIONAL');

-- 1. Create the Shift table
CREATE TABLE "Shift" (
    "id"               SERIAL NOT NULL,
    "name"             TEXT NOT NULL,
    "type"             "ShiftType" NOT NULL,
    "startTime"        TEXT,
    "endTime"          TEXT,
    "requiredHours"    DOUBLE PRECISION NOT NULL DEFAULT 8,
    "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 15,
    "rotationPattern"  TEXT,
    "isActive"         BOOLEAN NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"        TIMESTAMP(3),

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- 2. Add foreign key from Attendance.shiftId → Shift.id
ALTER TABLE "Attendance"
    ADD COLUMN "shiftId" INTEGER;
ALTER TABLE "Attendance"
    ADD CONSTRAINT "Attendance_shiftId_fkey"
    FOREIGN KEY ("shiftId")
    REFERENCES "Shift"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
