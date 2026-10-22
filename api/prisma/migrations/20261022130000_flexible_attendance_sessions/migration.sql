CREATE TABLE "AttendanceSession" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "shiftId" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "checkInSource" "AttendanceCheckoutSource",
    "checkInActorId" INTEGER,
    "checkoutSource" "AttendanceCheckoutSource",
    "checkoutActorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceSessionBreak" (
    "id" SERIAL NOT NULL,
    "attendanceSessionId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "AttendanceSessionBreak_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendanceSession_employeeId_startedAt_idx"
ON "AttendanceSession"("employeeId", "startedAt");

CREATE UNIQUE INDEX "AttendanceSession_one_open_per_employee_key"
ON "AttendanceSession"("employeeId")
WHERE "endedAt" IS NULL;

CREATE INDEX "AttendanceSession_organizationId_startedAt_idx"
ON "AttendanceSession"("organizationId", "startedAt");

CREATE INDEX "AttendanceSession_shiftId_idx"
ON "AttendanceSession"("shiftId");

CREATE INDEX "AttendanceSessionBreak_attendanceSessionId_startedAt_idx"
ON "AttendanceSessionBreak"("attendanceSessionId", "startedAt");

ALTER TABLE "AttendanceSession"
ADD CONSTRAINT "AttendanceSession_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceSession"
ADD CONSTRAINT "AttendanceSession_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceSession"
ADD CONSTRAINT "AttendanceSession_shiftId_fkey"
FOREIGN KEY ("shiftId") REFERENCES "Shift"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttendanceSession"
ADD CONSTRAINT "AttendanceSession_checkInActorId_fkey"
FOREIGN KEY ("checkInActorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttendanceSession"
ADD CONSTRAINT "AttendanceSession_checkoutActorId_fkey"
FOREIGN KEY ("checkoutActorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttendanceSessionBreak"
ADD CONSTRAINT "AttendanceSessionBreak_attendanceSessionId_fkey"
FOREIGN KEY ("attendanceSessionId") REFERENCES "AttendanceSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AttendanceSession" (
    "employeeId",
    "organizationId",
    "shiftId",
    "startedAt",
    "endedAt",
    "checkInSource",
    "checkoutSource",
    "checkoutActorId",
    "createdAt",
    "updatedAt"
)
SELECT
    a."employeeId",
    a."organizationId",
    COALESCE(a."shiftId", e."shiftId"),
    a."checkIn",
    a."checkOut",
    'USER'::"AttendanceCheckoutSource",
    a."checkoutSource",
    a."checkoutActorId",
    a."createdAt",
    CURRENT_TIMESTAMP
FROM "Attendance" a
JOIN "Employee" e ON e."id" = a."employeeId"
LEFT JOIN "Shift" attendance_shift ON attendance_shift."id" = a."shiftId"
LEFT JOIN "Shift" employee_shift ON employee_shift."id" = e."shiftId"
WHERE a."checkIn" IS NOT NULL
  AND a."checkOut" IS NOT NULL
  AND COALESCE(attendance_shift."type", employee_shift."type") = 'FLEXIBLE';
