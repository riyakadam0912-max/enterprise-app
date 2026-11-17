ALTER TABLE "TaskTimerSession"
ADD COLUMN "subsecondMilliseconds" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "TaskTimerSession"
ADD CONSTRAINT "TaskTimerSession_subsecondMilliseconds_check"
CHECK ("subsecondMilliseconds" >= 0 AND "subsecondMilliseconds" < 1000);
