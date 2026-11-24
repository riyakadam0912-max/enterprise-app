CREATE TYPE "AttendanceScheduledDayType" AS ENUM ('WORKING_DAY', 'CORPORATE_HOLIDAY', 'WEEKLY_OFF');
CREATE TYPE "AttendanceCreditSource" AS ENUM ('STANDARD', 'PUNCH', 'TASK_WORK', 'SHOOT_ASSIGNMENT', 'ADMIN');

ALTER TABLE "Attendance"
  ADD COLUMN "scheduledDayType" "AttendanceScheduledDayType" NOT NULL DEFAULT 'WORKING_DAY',
  ADD COLUMN "attendanceSource" "AttendanceCreditSource" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "creditedTaskId" INTEGER;

ALTER TABLE "LeaveCompOffClaim"
  ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'ATTENDANCE',
  ADD COLUMN "sourceTaskId" INTEGER,
  ADD COLUMN "validUntil" DATE;

CREATE INDEX "Attendance_scheduledDayType_date_idx" ON "Attendance"("scheduledDayType", "date");
CREATE INDEX "Attendance_creditedTaskId_idx" ON "Attendance"("creditedTaskId");
CREATE INDEX "LeaveCompOffClaim_validUntil_idx" ON "LeaveCompOffClaim"("validUntil");

UPDATE "Attendance"
SET "scheduledDayType" = CASE
  WHEN "status" = 'HOLIDAY' THEN 'CORPORATE_HOLIDAY'::"AttendanceScheduledDayType"
  WHEN "status" = 'WEEKLY_OFF' THEN 'WEEKLY_OFF'::"AttendanceScheduledDayType"
  ELSE 'WORKING_DAY'::"AttendanceScheduledDayType"
END;

UPDATE "Attendance" a
SET
  "attendanceSource" = 'SHOOT_ASSIGNMENT'::"AttendanceCreditSource",
  "creditedTaskId" = (
  SELECT t.id
  FROM "Task" t
  LEFT JOIN "TaskCrewAssignment" crew ON crew."taskId" = t.id
  LEFT JOIN "User" crew_user ON crew_user.id = crew."userId"
  WHERE t."taskType" = 'SHOOT'
    AND t."deletedAt" IS NULL
    AND t."shootDate" <= a.date::date
    AND COALESCE(t."shootEndDate", t."shootDate") >= a.date::date
    AND (t."assignedToId" = a."employeeId" OR crew_user."employeeId" = a."employeeId")
  ORDER BY t.id
  LIMIT 1
)
WHERE a."isShootDay" = true;

UPDATE "LeaveCompOffClaim"
SET "validUntil" = (date_trunc('month', "workDate") + interval '1 month')::date
WHERE "validUntil" IS NULL;

-- Reconcile every employee/date in historical multi-day shoots. Approved leave,
-- punches, and manual corrections remain authoritative.
WITH RECURSIVE org_roots AS (
  SELECT o.id, o.id AS root_id
  FROM "Organization" o
  WHERE o."parentId" IS NULL
  UNION ALL
  SELECT child.id, parent.root_id
  FROM "Organization" child
  JOIN org_roots parent ON parent.id = child."parentId"
),
shoot_employees AS (
  SELECT t.id AS task_id, t."shootDate", COALESCE(t."shootEndDate", t."shootDate") AS shoot_end, t."assignedToId" AS employee_id
  FROM "Task" t
  WHERE t."taskType" = 'SHOOT' AND t."deletedAt" IS NULL AND t."assignedToId" IS NOT NULL
  UNION
  SELECT t.id, t."shootDate", COALESCE(t."shootEndDate", t."shootDate"), u."employeeId"
  FROM "Task" t
  JOIN "TaskCrewAssignment" crew ON crew."taskId" = t.id
  JOIN "User" u ON u.id = crew."userId"
  WHERE t."taskType" = 'SHOOT' AND t."deletedAt" IS NULL AND u."employeeId" IS NOT NULL
),
shoot_days AS (
  SELECT se.task_id, se.employee_id, day::date AS work_date
  FROM shoot_employees se
  CROSS JOIN LATERAL generate_series(se."shootDate", se.shoot_end, interval '1 day') day
),
credits AS (
  SELECT
    sd.task_id,
    sd.employee_id,
    sd.work_date,
    e."organizationId" AS organization_id,
    e."shiftId" AS shift_id,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM "Holiday" h
        LEFT JOIN org_roots roots ON roots.id = e."organizationId"
        WHERE h."startDate" <= sd.work_date
          AND h."endDate" >= sd.work_date
          AND (
            (h."organizationId" = e."organizationId" AND h."familyRootOrganizationId" IS NULL)
            OR h."familyRootOrganizationId" = roots.root_id
          )
      ) THEN 'CORPORATE_HOLIDAY'::"AttendanceScheduledDayType"
      WHEN s.id IS NOT NULL AND NOT (EXTRACT(DOW FROM sd.work_date)::integer = ANY(s."workingDays"))
        THEN 'WEEKLY_OFF'::"AttendanceScheduledDayType"
      ELSE 'WORKING_DAY'::"AttendanceScheduledDayType"
    END AS scheduled_day_type
  FROM shoot_days sd
  JOIN "Employee" e ON e.id = sd.employee_id AND e."deletedAt" IS NULL
  LEFT JOIN "Shift" s ON s.id = e."shiftId"
)
INSERT INTO "Attendance" (
  "employeeId", "organizationId", "shiftId", date, status, "isShootDay",
  "scheduledDayType", "attendanceSource", "creditedTaskId", remarks
)
SELECT
  employee_id, organization_id, shift_id, work_date,
  CASE WHEN work_date <= CURRENT_DATE THEN 'PRESENT'::"AttendanceStatus" ELSE 'UPCOMING'::"AttendanceStatus" END,
  true, scheduled_day_type, 'SHOOT_ASSIGNMENT'::"AttendanceCreditSource", task_id, 'Shoot day credit'
FROM credits
ON CONFLICT ("employeeId", date) DO UPDATE SET
  status = CASE WHEN EXCLUDED.date <= CURRENT_DATE THEN 'PRESENT'::"AttendanceStatus" ELSE 'UPCOMING'::"AttendanceStatus" END,
  "isShootDay" = true,
  "scheduledDayType" = EXCLUDED."scheduledDayType",
  "attendanceSource" = EXCLUDED."attendanceSource",
  "creditedTaskId" = EXCLUDED."creditedTaskId",
  remarks = COALESCE("Attendance".remarks, 'Shoot day credit')
WHERE "Attendance"."manuallyCorrected" = false
  AND "Attendance".status <> 'LEAVE'
  AND "Attendance"."checkIn" IS NULL
  AND "Attendance"."checkOut" IS NULL;
