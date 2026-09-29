CREATE TABLE "TaskTimerSession" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "durationSeconds" INTEGER NOT NULL,
    "remainingSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskTimerSession_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TaskTimerSession" (
    "taskId", "userId", "organizationId", "status", "durationSeconds",
    "remainingSeconds", "startedAt", "totalSeconds", "updatedAt"
)
SELECT
    "id", "timerStartedByUserId", "organizationId", "timerStatus",
    "timerDurationSeconds", "timerRemainingSeconds", "timerStartedAt",
    CASE
        WHEN "timerStatus" = 'PAUSED' THEN GREATEST(0, "timerDurationSeconds" - "timerRemainingSeconds")
        ELSE 0
    END,
    CURRENT_TIMESTAMP
FROM "Task"
WHERE "timerStatus" IN ('RUNNING', 'PAUSED')
  AND "timerStartedByUserId" IS NOT NULL;

ALTER TABLE "Task"
RENAME COLUMN "timerTotalSeconds" TO "legacyTimerTotalSeconds";

ALTER TABLE "Timesheet"
ADD COLUMN "timerSessionId" INTEGER;

DROP INDEX IF EXISTS "Task_one_running_timer_per_user_idx";
DROP INDEX IF EXISTS "Task_timerStartedByUserId_idx";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_timerStartedByUserId_fkey";
ALTER TABLE "Task"
DROP COLUMN "timerStatus",
DROP COLUMN "timerDurationSeconds",
DROP COLUMN "timerRemainingSeconds",
DROP COLUMN "timerStartedAt",
DROP COLUMN "timerStartedByUserId";

CREATE UNIQUE INDEX "TaskTimerSession_one_running_timer_per_user_idx"
ON "TaskTimerSession"("userId")
WHERE "status" = 'RUNNING';
CREATE UNIQUE INDEX "TaskTimerSession_one_open_timer_per_user_task_idx"
ON "TaskTimerSession"("taskId", "userId")
WHERE "status" IN ('RUNNING', 'PAUSED');
CREATE INDEX "TaskTimerSession_taskId_status_idx" ON "TaskTimerSession"("taskId", "status");
CREATE INDEX "TaskTimerSession_userId_status_idx" ON "TaskTimerSession"("userId", "status");
CREATE INDEX "TaskTimerSession_organizationId_idx" ON "TaskTimerSession"("organizationId");
CREATE UNIQUE INDEX "Timesheet_timerSessionId_key" ON "Timesheet"("timerSessionId");

ALTER TABLE "TaskTimerSession"
ADD CONSTRAINT "TaskTimerSession_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskTimerSession"
ADD CONSTRAINT "TaskTimerSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskTimerSession"
ADD CONSTRAINT "TaskTimerSession_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Timesheet"
ADD CONSTRAINT "Timesheet_timerSessionId_fkey"
FOREIGN KEY ("timerSessionId") REFERENCES "TaskTimerSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;