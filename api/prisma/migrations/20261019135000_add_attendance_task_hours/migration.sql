ALTER TABLE "Attendance"
ADD COLUMN "taskHours" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Timesheet"
ADD COLUMN "employeeId" INTEGER;

UPDATE "Timesheet" AS timesheet
SET "employeeId" = (
    SELECT employee.id
    FROM "User" AS owner
    INNER JOIN "Employee" AS employee
      ON employee.id = owner."employeeId"
     AND employee."organizationId" = timesheet."organizationId"
    WHERE owner.id = timesheet."createdByUserId"
)
WHERE timesheet."employeeId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "User" AS owner
    INNER JOIN "Employee" AS employee
      ON employee.id = owner."employeeId"
     AND employee."organizationId" = timesheet."organizationId"
    WHERE owner.id = timesheet."createdByUserId"
  );

CREATE INDEX "Timesheet_employeeId_idx" ON "Timesheet"("employeeId");

ALTER TABLE "Timesheet"
ADD CONSTRAINT "Timesheet_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Attendance" AS attendance
SET "taskHours" = COALESCE((
    SELECT SUM(timesheet.hours)
    FROM "Timesheet" AS timesheet
    INNER JOIN "Employee" AS employee
      ON employee.id = timesheet."employeeId"
     AND employee."organizationId" = attendance."organizationId"
    WHERE timesheet."employeeId" = attendance."employeeId"
      AND timesheet."organizationId" = attendance."organizationId"
      AND timesheet.date::date = attendance.date::date
      AND timesheet.status <> 'REJECTED'
      AND timesheet."deletedAt" IS NULL
), 0);

INSERT INTO "Attendance" (
    "employeeId",
    "organizationId",
    date,
    status,
    "taskHours",
    "shiftId",
    "requiredHours",
    "createdAt",
    "lateMinutes",
    "overtimeHours",
    "shortfallHours",
    "isShootDay"
)
SELECT
    timesheet."employeeId",
    timesheet."organizationId",
    date_trunc('day', timesheet.date),
    'NOT_STARTED'::"AttendanceStatus",
    SUM(timesheet.hours),
    employee."shiftId",
    shift."requiredHours",
    CURRENT_TIMESTAMP,
    0,
    0,
    0,
    FALSE
FROM "Timesheet" AS timesheet
INNER JOIN "Employee" AS employee
  ON employee.id = timesheet."employeeId"
 AND employee."organizationId" = timesheet."organizationId"
LEFT JOIN "Shift" AS shift ON shift.id = employee."shiftId"
LEFT JOIN "Attendance" AS attendance
  ON attendance."employeeId" = timesheet."employeeId"
 AND attendance."organizationId" = timesheet."organizationId"
 AND attendance.date::date = timesheet.date::date
WHERE timesheet."employeeId" IS NOT NULL
  AND timesheet.status <> 'REJECTED'
  AND timesheet."deletedAt" IS NULL
  AND attendance.id IS NULL
GROUP BY timesheet."employeeId", timesheet."organizationId", employee."shiftId", shift."requiredHours", date_trunc('day', timesheet.date)
ON CONFLICT ("employeeId", date) DO UPDATE
SET "taskHours" = EXCLUDED."taskHours";
