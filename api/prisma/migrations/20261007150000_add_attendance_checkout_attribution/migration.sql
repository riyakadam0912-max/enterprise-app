CREATE TYPE "AttendanceCheckoutSource" AS ENUM ('USER', 'ADMIN_EDIT', 'AUTO');

ALTER TABLE "Attendance"
    ADD COLUMN "checkoutSource" "AttendanceCheckoutSource",
    ADD COLUMN "checkoutActorId" INTEGER;

CREATE INDEX "Attendance_checkoutActorId_idx" ON "Attendance"("checkoutActorId");

ALTER TABLE "Attendance"
    ADD CONSTRAINT "Attendance_checkoutActorId_fkey"
    FOREIGN KEY ("checkoutActorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;