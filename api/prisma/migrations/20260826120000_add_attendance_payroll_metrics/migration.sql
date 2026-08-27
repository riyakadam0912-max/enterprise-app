-- Add attendance thresholds and payroll shortfall metrics only.
ALTER TABLE "Shift"
ADD COLUMN "minPresentHours" DOUBLE PRECISION NOT NULL DEFAULT 5;

ALTER TABLE "Attendance"
ADD COLUMN "shortfallHours" DOUBLE PRECISION NOT NULL DEFAULT 0;