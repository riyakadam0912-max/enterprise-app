ALTER TABLE "Task"
ADD COLUMN "timerStatus" TEXT NOT NULL DEFAULT 'IDLE',
ADD COLUMN "timerDurationSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "timerRemainingSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "timerStartedAt" TIMESTAMP(3),
ADD COLUMN "timerStartedByUserId" INTEGER,
ADD COLUMN "timerTotalSeconds" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Timesheet"
ADD COLUMN "createdByUserId" INTEGER;

CREATE INDEX "Task_timerStartedByUserId_idx" ON "Task"("timerStartedByUserId");
CREATE INDEX "Timesheet_createdByUserId_idx" ON "Timesheet"("createdByUserId");
CREATE UNIQUE INDEX "Task_one_running_timer_per_user_idx"
ON "Task"("timerStartedByUserId")
WHERE "timerStatus" = 'RUNNING' AND "timerStartedByUserId" IS NOT NULL;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_timerStartedByUserId_fkey"
FOREIGN KEY ("timerStartedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Timesheet"
ADD CONSTRAINT "Timesheet_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;