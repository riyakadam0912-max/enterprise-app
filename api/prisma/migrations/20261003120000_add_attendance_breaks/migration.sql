CREATE TABLE "AttendanceBreak" (
  "id" SERIAL NOT NULL,
  "attendanceId" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "AttendanceBreak_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendanceBreak_attendanceId_startedAt_idx"
  ON "AttendanceBreak"("attendanceId", "startedAt");

ALTER TABLE "AttendanceBreak"
  ADD CONSTRAINT "AttendanceBreak_attendanceId_fkey"
  FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;